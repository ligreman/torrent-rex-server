'use strict';

/* INSTRUCCIONES
 - Ejecutar getLocations
 - Ejecutar correlateCines para a mano encontrar correlaciones.
 */

var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('md5'),
    fs = require('fs'),
    async = require('async'),
    events = require('events'),
    compare = require('levenshtein'),
    modelos = require('./models/models.js'),
    urlBase = 'http://www.ecartelera.com/',
    urlIMDB = 'http://www.imdb.com/showtimes/ES/',
    provincias = [], cines = [],
    codPostales = [], correlations = [];

var contadorE = 0, listaCadenas = '', listaIds = '', correlados = '';

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {safe: true}
});

//Gestor de eventos
var eventEmitter = new events.EventEmitter();

initCodPostalesArray();

//Cojo de mongo las correlaciones
modelos.Correlation
    .find().exec(function (err, correlat) {
        if (!err) {
            //Array de corr
            correlat.forEach(function (corr) {
                correlations[corr.cineId] = corr.imdbId;
            });

            getProvincias();
        }
    });


//Cojo la web de provincias
function getProvincias() {
    request(urlBase + 'cartelera', function (err, resp, body) {
        if (err || resp.statusCode !== 200) {
            console.log('Se produjo un error');
            throw err;
        }

        var $ = cheerio.load(body);
        /*var fs = require('fs');
         fs.writeFile("tmp/provincias.html", body, function (err) {
         if (err) {
         return console.log(err);
         }
         console.log("The file was saved!");
         });*/

        console.log(' - - ');
        console.log(' ------------ Obtengo provincias -------------- ');
        console.log(' - - ');

        //Por cada provincia...
        $('ul.cityselector li a').each(function () {
            var pId = extractId($(this).attr('href'));

            if (pId === null) {
                return false;
            }

            var name = $(this).text().trim();
            console.log(' ·Provincia: ' + name + ' (Id: ' + pId + ')');

            provincias.push({
                _id: md5(pId),
                provinciaId: pId,
                nombre: name,
                ciudades: [],
                actualizado: new Date().getTime(),
                sortfield: sortfielizar(name)
            });
        });

        //console.log(provincias);
        console.log(' - - ');
        console.log(' ------------ Obtengo ciudades y cines -------------- ');
        console.log(' - - ');

        //Por cada provincia voy recogiendo sus ciudades y cines
        async.map(provincias, getCiudades, function (err, results) {
            if (err) {
                throw err;
            } else {
                provincias = results;

                //Lanzo el proceso de actualización en Mongo de las cosas
                eventEmitter.emit('updateProvincias', provincias);
            }
        });

    });
}

//Obtiene las ciudades de una provincia y sus cines
function getCiudades(provincia, callback) {
    var enlaceCiudad = urlBase + 'cines/' + provincia.provinciaId;
    console.log(' -- Miro las ciudades del enlace: ' + enlaceCiudad);

    //Saco el id de IMBD del cine
    var codpost = codPostales[provincia.nombre];

    //Lo consulto en IMDB
    request(urlIMDB + codpost, function (err, response, body) {
        if (err) {
            callback(err);
        } else {
            var $IMDB = cheerio.load(body);

            request(enlaceCiudad, function (err, response, body) {
                if (err) {
                    callback(err);
                } else {
                    var $ = cheerio.load(body),
                        lastCityId = 0, lastCityName = '';

                    var counter = 0;

                    //Saco las ciudades y de paso los cines también
                    $('ul.cityselector li').each(function () {
                        var enlace = $(this).find('a');

                        //Si es título, es que es ciudad
                        if ($(this).hasClass('tit')) {
                            var cityId = lastCityId = extractId(enlace.attr('href'));
                            var cityName = lastCityName = enlace.text().trim();

                            console.log('   ··Ciudad: ' + cityName + ' (Id: ' + cityId + ')');

                            //Añado la ciudad a la lista de la provincia
                            provincia.ciudades.push({
                                _id: md5(cityId),
                                ciudadId: cityId,
                                nombre: cityName,
                                actualizado: 0
                            });
                        } else {
                            //Si no está inactivo, es un cine de la ciudad
                            if (!enlace.hasClass('inactivo') && lastCityId !== 0) {
                                var cineId = extractId(enlace.attr('href'));
                                var cineName = enlace.text().trim();
                                var idIMDB = null, nameIMDB = '';

                                var nombresIMDB = '', idsIMDB = '';

                                console.log('       ··Cine: ' + cineName + ' (Id: ' + cineId + ')');

                                //Si ya está el id del cine correlado no hago más que añadirlos a la lista de correlados
                                if (correlations[cineId] !== undefined) {
                                    idIMDB = correlations[cineId];
                                    correlados = (correlados == '') ? cineId + '##' + idIMDB : correlados + '$$' + cineId + '##' + idIMDB;
                                } else {
                                    //INTENTO SACARLOS. Por cada cine en IMDB comparo a ver si es este cine
                                    $IMDB('div[itemtype="http://schema.org/MovieTheater"]').each(function () {
                                        var h3Cine = $(this).find('h3');
                                        var enlaceCine = h3Cine.find('a[itemprop="url"]');
                                        var thisIdIMDB = extractIMDBId(enlaceCine.attr('href').trim());

                                        //Comparo nombres
                                        nameIMDB = enlaceCine.text().trim();

                                        //Auxiliares
                                        nombresIMDB = (nombresIMDB == '') ? nameIMDB : nombresIMDB + '||' + nameIMDB;
                                        idsIMDB = (idsIMDB == '') ? thisIdIMDB : idsIMDB + '||' + thisIdIMDB;

                                        var comparison = new compare(prepareToCompare(nameIMDB), prepareToCompare(cineName));
                                        if (comparison.distance < 4) {
                                            idIMDB = thisIdIMDB;
                                            return false; //salgo del bucle
                                        } else {
                                            //Comprobaciones extra
                                            if (cineName.indexOf(nameIMDB) > -1 || nameIMDB.indexOf(cineName) > -1) {
                                                idIMDB = thisIdIMDB;
                                                return false;
                                            }
                                        }
                                    });

                                    if (idIMDB === null) {
                                        //console.log('         *** No encontré el cine << ' + cineName + ' >> de ' + lastCityName + ' (' + provincia.nombre + ') CODPOSTAL: ' + codpost);
                                        //console.log('         *** De entre estos: ' + nombresIMDB);
                                        listaCadenas = (listaCadenas == '') ? cineName + '##' + nombresIMDB : listaCadenas + '$$' + cineName + '##' + nombresIMDB;
                                        listaIds = (listaIds == '') ? cineId + '##' + idsIMDB : listaIds + '$$' + cineId + '##' + idsIMDB;
                                        counter = counter + 1;
                                        contadorE++;
                                    } else {
                                        console.log("       --IMDB: " + nameIMDB + ' (Id: ' + idIMDB + ')');
                                        correlados = (correlados == '') ? cineId + '##' + idIMDB : correlados + '$$' + cineId + '##' + idIMDB;
                                    }
                                }

                                //Añado el cine a la lista de cines
                                cines.push({
                                    _id: md5(cineId),
                                    cineId: cineId,
                                    imdbId: idIMDB,
                                    nombre: cineName,
                                    _idCiudad: md5(lastCityId),
                                    nombreCiudad: lastCityName,
                                    actualizado: 0
                                });
                            }
                        }

                    });

                    console.log('No encontré de esta provincia: ' + counter);
                    callback(null, provincia); // First param indicates error, null=> no error
                }
            });


        }
    });


}


//Listener del evento de actualizar provincias y ciudades en Mongo
eventEmitter.on('updateProvincias', function (misProvincias) {
    //Limpio la colección de provincias
    modelos.Provincia.remove({}, function (err) {
    });

    //Guardo en base de datos
    modelos.Provincia.create(misProvincias, function (err) {
        if (err) {
            console.error(err);
        }

        console.log('    Mongo - He metido ' + misProvincias.length + ' provincias');

        //Emito señal para continuar
        eventEmitter.emit('updateCines', cines);
    });
});

//Listener del evento de actualizar cines en Mongo
eventEmitter.on('updateCines', function (misCines) {
    //Limpio la colección de cines
    modelos.Cine.remove({}, function (err) {
    });

    //Guardo en base de datos
    modelos.Cine.create(misCines, function (err) {
        if (err) {
            console.error(err);
        }

        console.log('    Mongo - He metido ' + misCines.length + ' cines');

        //Finalizo
        eventEmitter.emit('finalize');
    });
});

//Listener del evento de terminar
eventEmitter.on('finalize', function () {
    mongoose.disconnect();
    console.log('Finalizado');

    console.log('No encontré: ' + contadorE);
    fs.writeFileSync("cadenasNotFound.txt", listaCadenas);
    fs.writeFileSync("idsNotFound.txt", listaIds);
    fs.writeFileSync("correlados.txt", correlados);

    //Finalizo
    process.exit();
});

//Extrae el id de un enlace http://www.ecartelera.com/cines/0,165,0.html que es 0,165,0.html
function extractId(href) {
    var patt = /(\/cines\/)(.+)/;

    var res = patt.exec(href);

    if (res !== null) {
        return res[2];
    } else {
        return null;
    }
}

function extractIMDBId(href) {
    var patt = /(.*\/)(ci[0-9]+)(\/.*)/;

    var res = patt.exec(href);

    if (res !== null) {
        return res[2];
    } else {
        return null;
    }
}

function sortfielizar(text) {
    text = text.toLowerCase();

    text = text.replace(' ', '_');
    text = text.replace('.', '_');
    text = text.replace('á', 'a');
    text = text.replace('é', 'e');
    text = text.replace('í', 'i');
    text = text.replace('ó', 'o');
    text = text.replace('ú', 'u');
    text = text.replace('ñ', 'n');
    return text;
}

//Elimina ciertas palabras para poder comparar mejor
function prepareToCompare(text) {
    text = text.replace(/Cine(s)?/g, '');
    return text;
}

function initCodPostalesArray() {
    codPostales['A Coruña'] = '15001';
    codPostales['Álava'] = '01001';
    codPostales['Albacete'] = '02001';
    codPostales['Alicante'] = '03001';
    codPostales['Almería'] = '04001';
    codPostales['Asturias'] = '33001';
    codPostales['Ávila'] = '05001';
    codPostales['Badajoz'] = '06001';
    codPostales['Baleares'] = '07001';
    codPostales['Barcelona'] = '08001';
    codPostales['Burgos'] = '09001';
    codPostales['Cáceres'] = '10001';
    codPostales['Cádiz'] = '11001';
    codPostales['Cantabria'] = '39001';
    codPostales['Castellón'] = '12001';
    codPostales['Ceuta'] = '51001';
    codPostales['Ciudad Real'] = '13001';
    codPostales['Córdoba'] = '14001';
    codPostales['Cuenca'] = '16001';
    codPostales['Girona'] = '17001';
    codPostales['Granada'] = '18001';
    codPostales['Guadalajara'] = '19001';
    codPostales['Guipúzcoa'] = '20001';
    codPostales['Huelva'] = '21001';
    codPostales['Huesca'] = '22001';
    codPostales['Jaén'] = '23001';
    codPostales['La Rioja'] = '26001';
    codPostales['Las Palmas'] = '35001';
    codPostales['León'] = '24001';
    codPostales['Lleida'] = '25001';
    codPostales['Lugo'] = '27001';
    codPostales['Madrid'] = '28001';
    codPostales['Málaga'] = '29001';
    codPostales['Melilla'] = '52001';
    codPostales['Murcia'] = '30001';
    codPostales['Navarra'] = '31001';
    codPostales['Ourense'] = '32001';
    codPostales['Palencia'] = '34001';
    codPostales['Pontevedra'] = '36001';
    codPostales['S.C. Tenerife'] = '38001';
    codPostales['Salamanca'] = '37001';
    codPostales['Segovia'] = '40001';
    codPostales['Sevilla'] = '41001';
    codPostales['Soria'] = '42001';
    codPostales['Tarragona'] = '43001';
    codPostales['Teruel'] = '44001';
    codPostales['Toledo'] = '45001';
    codPostales['Valencia'] = '46001';
    codPostales['Valladolid'] = '47001';
    codPostales['Vizcaya'] = '48001';
    codPostales['Zamora'] = '49001';
    codPostales['Zaragoza'] = '50001';
}