/** Copyright 2015 Board of Trustees of University of Illinois
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var router = express.Router();
var fs = require('fs');
var client = require('./../../modules/redis');
var passwordHash = require('password-hash');
var crypto = require('crypto');

// Variables that will be passed into the command line when running containers
var nodemailer = require('nodemailer');
var mailID = process.env.EMAIL_ID;
var mailPass = process.env.EMAIL_PASS;

if (!mailID) throw "Need a gmail address in environmental variables!";
if (!mailPass) throw "Need a password in environmental variables!";

// Create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: mailID,
      pass: mailPass
    }
});

// Get the mustache page that will be rendered for the signup route
var signupMustache = fs.readFileSync(mustachePath + 'signup.mustache').toString();

// Render the signup mustache page; if account is authenticated, just bring user to dashboard
router.get('/signup', function(request, response) {
    if (request.isAuthenticated()) {
        response.redirect('../dashboard');
    } else {
        response.writeHead(200, {
            'Content-Type': 'text.html'
        });
        renderWithPartial(signupMustache, request, response);
    }
});

// Add new user information to database after the form is submitted
router.post('/signup/submit', function(request, response) {
    var first_name = request.body.first_name;
    var last_name = request.body.last_name;
    var email = request.body.email;
    var password = request.body.password;
    var re_password = request.body.re_password;

    // Check that the two passwords are the same
    if (password != re_password) {
        var error = "Passwords are not the same";
        console.log(error);
        response.send({ message: error, html: '' });
    } else {
        // Check if email is already in the database
        client.hgetall("ClassTranscribe::Users::" + email, function(err, obj) {
            if (obj) {
                var error = "Account already exists";
                console.log(error);
                response.send({ message: error, html: '' });
            } else {
                // Salt and hash password before putting into redis database
                var hashedPassword = passwordHash.generate(password);

                // Add new user to database
                client.hmset("ClassTranscribe::Users::" + email, [
                    'first_name', first_name,
                    'last_name', last_name,
                    'password', hashedPassword,
                    'change_password_id', '',
                    'university', getUniversity(email),
                    'verified', false,
                    'verify_id', '',
                    'courses_as_instructor','',
                    'courses_as_TA','',
                    'courses_as_student',''
                ], function (err, results) {
                    if (err) console.log(err)
                    console.log(results);

                    // Generate a unique link specific to the user
                    crypto.randomBytes(48, function(err, buffer) {
                        var token = buffer.toString('hex');
                        var host = request.get('host');
                        var link = "https://" + host + "/verify?email=" + email + "&id=" + token;

                        // Send email to verify .edu account
                        var mailOptions = {
                            from: 'ClassTranscribe Team <' + mailID + '>', // ClassTranscribe no-reply email
                            to: email, // receiver who signed up for ClassTranscribe
                            subject: 'Welcome to ClassTranscribe', // subject line of the email
                            html: 'Hi ' + first_name + ' ' + last_name + ', <br><br> Thanks for registering at ClassTranscribe. Please verify your email by clicking this <a href=' + link + '>link</a>. <br><br> Thanks! <br> ClassTranscribe Team',
                        };

                        // Add the token ID to database to check it is linked with the user
                        client.hmset("ClassTranscribe::Users::" + email, [
                            'verify_id', token
                        ], function(err, results) {
                            if (err) console.log(err)
                            console.log(results);
                        });

                        // Send the custom email to the user
                        transporter.sendMail(mailOptions,(error, response)=> {
                            if (err) console.log(err)
                            console.log("Send mail status: " + response);
                        });
                    });

                    // Redirect the login page after successfully creating new user
                    response.send({ message: 'success', html: '../login' })
                });
            }
        })
    }
});

// Get the mustache page that will be rendered for the verify route
var verifyMustache = fs.readFileSync(mustachePath + 'verify.mustache').toString();

router.get('/verify', function (request, response) {
    // Get the current user's data to access information in database
    email = request.query.email

    // Search in the database for instances of the key
    client.hgetall("ClassTranscribe::Users::" + email, function(err, usr) {
        // Display error when account does not exist in the database
        if (!usr) {
            var error = "Account does not exist.";
            console.log(error);
            response.end();
            // TODO: ADD 404 PAGE
        } else {
            // Check if the user verify link ID matches the email
            client.hget("ClassTranscribe::Users::" + email, "verify_id", function(err, obj) {
                // Display error if the generated unique link does not match the user
                if (obj != request.query.id) {
                    var error = "Email is not verified.";
                    console.log(error);
                    response.end();
                    // TODO: ADD 404 PAGE
                } else {
                    // Change email as verified
                    client.hmset("ClassTranscribe::Users::" + email, [
                        'verified', true,
                        'verify_id', ''
                    ], function(err, results) {
                        if (err) console.log(err)
                        console.log(results);
                    });
                    console.log("Email is verified.")

                    // Render the verify mustache page
                    response.writeHead(200, {
                        'Content-Type': 'text.html'
                    });
                    renderWithPartial(verifyMustache, request, response);
                }   
            });
        }
    });
});

function getUniversity(email){
    var domain = email.split('@')[1]
    var data = JSON.parse(fs.readFileSync('./utils/world_universities_and_domains.json'))
    for (var i = 0; i < data.length; i++){
        if (data[i].domains[0] == domain){
            return data[i].name
        }
    }
}

module.exports = router;