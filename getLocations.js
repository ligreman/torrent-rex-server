var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('MD5'),
    async = require('async'),
    Q = require('q'),
    http = require('http');

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {
        safe: true
    }
});

var modelos = require('./models/models.js'),
    urlProvincias = 'http://www.sensacine.com/cines/',
    urlCiudades = 'http://www.sensacine.com/cines/?cgeocode=',
    provincias = [];

//Cojo la web de provincias
request(urlProvincias, function (err, resp, body) {
    if (err || resp.statusCode !== 200) {
        console.log('Se produjo un error');

        throw err;
    }

    //Saco las páginas que tiene
    var $ = cheerio.load(body);
    $('a[href^="/cines/?cgeocode="]').each(function () {
        var pId = parseInt($(this).attr('href').replace('/cines/?cgeocode=', ''));
        var name = $(this).text().replace(/\n/g, '');
        console.log(pId);
        console.log(name);

        provincias.push({
            _id: md5(pId),
            provinciaId: pId,
            nombre: name,
            ciudades: []
        });
    });

    //console.log(provincias);

    async.map(provincias, getCiudades, function (err, results) {
        if (err) {
            throw err;
        } else {
            provincias = results;

            //Guardo en base de datos
            modelos.Provincia.create(provincias, function (err) {
                if (err) {
                    console.error(err);
                }

                mongoose.disconnect();
                console.log("Se terminó");
                //Finalizo
                process.exit();
            });
        }
    });

});

function getCiudades(provincia, callback) {
    request.get(urlCiudades + provincia.provinciaId, function (err, response, body) {
        if (err) {
            callback(err);
        } else {
            var $ = cheerio.load(body);
            ///cines/cines-en-
            $('a[href^="/cines/cines-en-"]').each(function () {
                var cId = parseInt($(this).attr('href').replace('/cines/cines-en-', ''));
                var name = $(this).text().replace(/\n/g, '');

                provincia.ciudades.push({
                    _id: md5(cId),
                    ciudadId: cId,
                    nombre: name
                    //cine: []
                });

            });
            callback(null, provincia); // First param indicates error, null=> no error
        }
    });
}

/*
 var sesion = new modelos.Sesion({
 _pelicula: "5e4c0ce8a1b0b2448abd7098086a6df7",
 horario: ["20:20", "20:45"]
 });

 var sesion2 = new modelos.Sesion({
 _pelicula: "01c8f20d17dd4633c1306a24dfe2f841",
 horario: ["10:20", "10:45"]
 });

 var cine = new modelos.Cine({
 _id: "cinecito",
 cineId: "abcd",
 nombre: "Cinexio",
 direccion: "Aqui o alla",
 codigoPostal: 25412,
 sesion: [sesion, sesion2]
 });

 var ciudad = new modelos.Ciudad({
 _id: "987",
 nombre: "Leon",
 cine: [cine]
 });


 var provincia = new modelos.Provincia({
 nombre: "LeonVincia",
 ciudad: [ciudad]
 });

 provincia.save();
 */
//Rescato
/*Cine.find().populate('ciudad.cine.pelicula._pelicula').exec(function (err, cines) {
 console.log(err);
 cines.forEach(function (cine) {
 console.log(cine);
 });
 });*/
/*
 modelos.Provincia.findOne().populate('_pelicula').exec(function (err, cines) {
 console.log(err);
 console.log(cines);
 *//*cines.forEach(function (cine) {
 console.log(cine);
 });
 *//*
 console.log(cines.ciudad);
 console.log(cines.ciudad[0].cine);
 mongoose.disconnect();
 });*/
//populate('_pelicula').
