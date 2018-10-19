const uuid = require('uuid/v4');
'use strict';
// var models = require('../models');
module.exports = (sequelize, DataTypes) => {
    var Lecture = sequelize.define('Lecture', {
        id: { type: DataTypes.UUIDV4, primaryKey: true, defaultValue: uuid() },
        date: DataTypes.TEXT,
    });

    Lecture.associate = function(models) {
      models.Lecture.belongsTo(models.Offering, { foreignKey: 'offeringId' });
      models.Lecture.belongsTo(models.Media, { foreignKey: 'mediaId' });
    };

    return Lecture;
};
