'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var serieExtractSchema = new Schema({
    _id: String,
    id: String,
    name: String
});


var seriesTSchema = new Schema({
    _id: String,
    sd: [serieExtractSchema],
    hd: [serieExtractSchema],
    vo: [serieExtractSchema]
});
var seriesNSchema = new Schema({
    _id: String,
    sd: [serieExtractSchema],
    hd: [serieExtractSchema],
    vo: [serieExtractSchema]
});


var serieDetailSchema = new Schema({
    _id: String,
    id: String,
    name: String,
    url: String,
    source: String,
    lastUpdate: Number,
    seasons: {}
});
/*
 module.exports = {
 Serie: dbTrex.model('Serie', serieDetailSchema),
 SerieExtract: dbTrex.model('SerieExtract', serieExtractSchema),
 SeriesT: dbTrex.model('SeriesT', seriesTSchema),
 SeriesN: dbTrex.model('SeriesN', seriesNSchema)
 };*/

module.exports = {
    serieDetailSchema: serieDetailSchema,
    serieExtractSchema: serieExtractSchema,
    seriesTSchema: seriesTSchema,
    seriesNSchema: seriesNSchema
};