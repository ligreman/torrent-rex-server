module.exports = function (app) {
    var request = require('request'),
        cheerio = require('cheerio'),
        mongoose = require('mongoose');

    //Cargo los modelos
    var modelos = require('../models/models.js');

    //Conecto a mongo
    mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
        db: {
            safe: true
        }
    });

    var getPelicula = function (req, res) {
        var url = 'http://www.sensacine.com/peliculas/pelicula-' + req.params.peliculaId;

        response = {
            categories: innerCategories,
            error: ""
        };

        //Respuesta
        res.set({
            'Content-Type': 'application/json; charset=utf-8'
        }).json(response);
    };

    var getPeliculas = function (req, res) {
        var url = 'http://www.sensacine.com/peliculas/en-cartelera/cines';

        response = {
            categories: innerCategories,
            error: ""
        };

        //Respuesta
        res.set({
            'Content-Type': 'application/json; charset=utf-8'
        }).json(response);
    };

    /**
     * Obtiene los cines de una ciudad
     */
    var getCines = function (req, res) {
        var ciudadId = req.params.ciudadId;

        console.log("Hola cines");

        modelos.Cine.find({ciudadId: ciudadId})
            .exec(function (err, cines) {
                response = {
                    cines: cines,
                    error: ""
                };

                //Respuesta
                res.set({
                    'Content-Type': 'application/json; charset=utf-8'
                }).json(response);
            });
    };


    /**
     * Obtiene el listado de provincias y ciudades
     */
    var getCiudades = function (req, res) {
        console.log("Hola ciudades");
        //Consulto a mongo
        modelos.Provincia
            .find()
            //.select('provinciaId nombre ciudad ciudad.nombre')
            //.aggregate({$project: {provinciaId: 1, ciudad: {nombre: 1}}})
            //.unwind('ciudad')
            .exec(function (err, provincias) {

                /*provincias.forEach(function (provincia) {

                 });*/
                //console.log(provincias);
                response = {
                    provincias: provincias,
                    error: ""
                };

                //Respuesta
                res.set({
                    'Content-Type': 'application/json; charset=utf-8'
                }).json(response);
            });
    };

    //Los paths 1f5bb3d2b0cdb7327d5b94bb2a791e28
    app.get('/api/cine/peliculas', getPeliculas);
    app.get('/api/cine/peliculas/:peliculaId', getPelicula);
    app.get('/api/cine/ciudades/:peliculaId', getPelicula);

    app.get('/api/cine/ciudades', getCiudades);
    app.get('/api/cine/cines/:ciudadId', getCines);

    //Controlamos el cierre para desconectar mongo
    process.stdin.resume();//so the program will not close instantly

    function exitHandler(options, err) {
        if (options.exit) {
            mongoose.disconnect();
            process.exit();
        }
    }

    //do something when app is closing
    process.on('exit', exitHandler.bind(null, {exit: true}));

    //catches ctrl+c event
    process.on('SIGINT', exitHandler.bind(null, {exit: true}));
};
