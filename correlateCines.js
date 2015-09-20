'use strict';

var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('md5'),
    fs = require('fs'),
    prompt = require('readline-sync'),
    async = require('async'),
    events = require('events'),
    compare = require('levenshtein'),
    modelos = require('./models/models.js'),
    urlBase = 'http://www.ecartelera.com/',
    urlIMDB = 'http://www.imdb.com/showtimes/ES/';

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {safe: true}
});


//Gestor de eventos
var eventEmitter = new events.EventEmitter();

//eventEmitter.emit('updateProvincias', provincias);

//console.log("" + cadenas);
//console.log("" + ids);


//Limpio la colección de correlados
modelos.Correlation.remove({}, function (err) {
    eventEmitter.emit('loadCorrelations');
});


//Cargo en Mongo las correlaciones correctas
eventEmitter.on('loadCorrelations', function () {
    var correlados = fs.readFileSync('correlados.txt', 'utf-8');

    var correlaciones = [];

    correlados = correlados.split('$$');
    correlados.forEach(function (elem) {
        elem = elem.split('##');
        var original = elem[0], imdb = elem[1];

        correlaciones.push({
            cineId: original,
            imdbId: imdb
        });
    });

    //Guardo en base de datos
    modelos.Correlation.create(correlaciones, function (err) {
        if (err) {
            console.error(err);
        }

        eventEmitter.emit('preguntar');
    });
});


eventEmitter.on('preguntar', function () {
    var correlaciones = [], continuar = true;

    var cadenas = fs.readFileSync('cadenasNotFound.txt', 'utf-8');
    var ids = fs.readFileSync('idsNotFound.txt', 'utf-8');

    var aCadenas = cadenas.split('$$');
    var aIds = ids.split('$$');

    console.log(aCadenas.length + " -- " + aIds.length);
    //console.log('-99 para guardar y salir');

    //Pregunto por el resto
    aCadenas.forEach(function (cadena, index) {
        var id = aIds[index], counter = 0, arrayNames = [];

        //¿Sigo?
        if (!continuar) {
            return false;
        }

        var bloquesCads = cadena.split('##'),
            bloquesIds = id.split('##');

        var originalName = bloquesCads[0],
            originalId = bloquesIds[0];

        var otrosNames = bloquesCads[1].split('||'),
            otrosIds = bloquesIds[1].split('||');

        if (otrosNames.length) {
            counter = 0;
            arrayNames = [];

            otrosNames.forEach(function (elem, ind) {
                //Máximo 36 opciones
                if (counter <= 34) {
                    arrayNames[ind] = tildes(elem);
                }
                counter++;
            });

            var selection = prompt.keyInSelect(arrayNames, 'Correspondencia de -> ' + tildes(originalName) + ': ');

            if (selection > -1) {
                var selectedName = arrayNames[selection],
                    selectedId = otrosIds[selection];

                correlaciones.push({
                    cineId: originalId,
                    imdbId: selectedId
                });
            }
            /*else if (selection === -99) {
             //Si cancelo salgo del bucle y guardo lo que lleve
             console.log('cancelo');
             continuar = false;
             }*/
        } else {
        }
    });

    //Guardo correlaciones
    modelos.Correlation.create(correlaciones, function (err) {
        if (err) {
            console.error(err);
        }

        eventEmitter.emit('updateCines', correlaciones);
    });
});

//Actualizo los cines en Mongo
eventEmitter.on('updateCines', function (correlaciones) {
    var aCorr = [];

    //Array de corr
    correlaciones.forEach(function (corr) {
        aCorr[corr.cineId] = corr.imdbId;
    });

    console.log("Guardo cines");

    modelos.Cine
        .find()
        .exec(function (err, cines) {
            if (!err) {
                //Compruebo cada cine
                cines.forEach(function (cine) {
                    if (cine.imdbId == null) {
                        //¿Tengo correlación?
                        if (aCorr[cine.cineId] !== undefined) {
                            console.log('cine ' + cine.cineId + '(' + aCorr[cine.cineId] + ')');
                            cine.imdbId = aCorr[cine.cineId];

                            modelos.Cine.collection.update({"_id": cine._id}, {$set: {"imdbId": cine.imdbId}});

                            //cinesActualizados.push(cine);
                            /*cine.save(function (err) {
                             if (err) {
                             console.log("Error: " + err);
                             } else {
                             console.log("guardado");
                             }
                             });*/
                            /*var cinecito = modelos.Cine(cine);
                             cinecito.save(function (err) {
                             if (err) {
                             console.log("Error: " + err);
                             } else {
                             console.log("guardado");
                             }
                             });*/
                            /*console.log(cine._id);
                             modelos.Cine.update({"_id": cine._id}, {$set: {"imdbId": cine.imdbId}}, function (err, raw) {
                             if (err) {
                             console.log(err);
                             }
                             });*/
                        }
                    }
                });

                eventEmitter.emit('finalize');
            }
        });
});


//Listener del evento de terminar
eventEmitter.on('finalize', function () {

    mongoose.disconnect();
    process.exit();
});


function tildes(text) {
    text = text.replace('á', 'a');
    text = text.replace('é', 'e');
    text = text.replace('í', 'i');
    text = text.replace('ó', 'o');
    text = text.replace('ú', 'u');
    text = text.replace('Á', 'A');
    text = text.replace('É', 'E');
    text = text.replace('Í', 'I');
    text = text.replace('Ó', 'O');
    text = text.replace('Ú', 'U');
    return text;
}