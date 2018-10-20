﻿'use strict';
var Sequelize = require('sequelize');
var models = require('../models');
models.sequelize.sync();

const Op = Sequelize.Op;
const CourseOffering = models.CourseOffering;
const Courses = models.Courses;
const Dept = models.Dept;
const EchoSection = models.EchoSection;
const Lecture = models.Lecture;
const Media = models.Media;
const MSTranscriptionTask = models.MSTranscriptionTask;
const Offering = models.Offering;
const Role = models.Role;
const Term = models.Term;
const University = models.University;
const User = models.User;
const UserOffering = models.UserOffering;
/* ----- end of defining ----- */

function addCourseAndSection(courseId, sectionId, downloadHeader) {
    return EchoSection.findOrCreate({
        where: {
            sectionId: sectionId
        },
        defaults: {
            sectionId: sectionId,
            courseId: courseId,
            json: {
                downloadHeader: downloadHeader
            }
        }
    });
}

function addMedia(videoURL, sourceType, siteSpecificJSON) {
    return Media.create({
        videoURL: videoURL,
        sourceType: sourceType,
        siteSpecificJSON: siteSpecificJSON
    });
}

function addMSTranscriptionTask(mediaId) {
    return MSTranscriptionTask.create({
        mediaId: mediaId
    });
}

function getTask(taskId) {
    return MSTranscriptionTask.findById(taskId);
}

function getMedia(mediaId) {
    return Media.findById(mediaId);
}

function getEchoSection(sectionId) {
    return EchoSection.findById(sectionId);
}

/* findOrCreate University first,
 * then findOrCreate user, and append universityId
 *
 * This is not a suggested way according to the documentation,
 * though I haven't found a better and correct implementation.
 */
function createUser(user) {
  return
  University
  .findOrCreate({
    where : { universityName : user.university }
  })
  .then((result) => {
    return User.findOrCreate({
      where : { mailId : user.mailId },
      defaults : {
        firstName : user.firstName,
        lastName : user.lastName,
        password : user.password,
        verifiedId : null, // provide verifyId after being verified
        universityId : result[0].dataValues.id, // result is an array of json object
      }
    });
  });
}

/* SELECT * FROM User WHERE mailId=email LIMIT 1*/
function getUserByEmail(email) {
  /* Since the email should be unique,
   * findOne() is sufficient
   */
  return User.findOne({
    where : { mailId : email }
  });
}

/* UPDATE User SET verifiedId = verifiedId WHERE mailId = email */
function verifyUser(verifiedId, email) {
  return User.update( {
    verifiedId : verifiedId,
  }, {
    where : {
      mailId : email,
    }
  });
}

function setUserName(name, email) {
  return User.update({
    firstName : name.firstName,
    lastName : name.lastName,
  }, {
    where : {
      mailId : email,
    }
  });
}

function setUserPassword(newPassword, email) {
  return User.update({
    password : newPassword,
  }, {
    where : {
      mailId : email,
    }
  });
}

/* Add university to Table Universities,
 * Shouldn't be used since we
 * currently only support UIUC
 */
function addUniversity(University) {
  return University.findOrCreate({
    where: {
      universityName : University,
    }
  });
}

/* Assming input is an array */
function getCoursesByTerms(term) {
  return Term.findAll({ // fetch termId
    where : {
      termName : { [Op.or] : term } // SELECT * FROM Term WHERE termName IN term
    }
  }).then((result) => { // fetch offeringId
    return Offering.findAll({
      where : {
        termId: { [Op.or] : result } // SELECT * FROM Offering WHERE termId IN result
      }
    });
  }).then((result) => { // fetch courseId
    return CourseOffering.findAll({
      where : {
        offeringId : { [Op.or] : result} // SELECT * FROM CourseOffering WHERE offeringId IN result
      }
    });
  }).then((result) => { // fetch Courses
    return getCoursesByIds(result);
  });
}

/* SELECT * FROM Course WHERE id IN courseId */
function getCoursesByIds(courseId) {
  return Course.findAll({
    where : {
      id : { [Op.or] : result }
    }
  })
}

function addLecture( courseId, mediaId, date ) {
  return Lecture.findOrCreate({
    where : {
      courseId : courseId,
      mediaId : mediaId,
    } ,
    defaults : {
      date : date,
    },
  });
}

module.exports = {
    models: models,
    addCourseAndSection: addCourseAndSection,
    addMedia: addMedia,
    addMSTranscriptionTask: addMSTranscriptionTask,
    getTask: getTask,
    getMedia: getMedia,
    getEchoSection: getEchoSection,
    createUser: createUser,
    getUserByEmail: getUserByEmail,
    verifyUser: verifyUser,
    setUserName: setUserName,
    addUniversity: addUniversity,
    getCoursesByTerms : getCoursesByTerms,
    getCoursesByIds : getCoursesByIds
}
