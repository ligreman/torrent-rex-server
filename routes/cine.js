'use strict';
var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    modelos = require('../models/models.js'),
    md5 = require('md5'),
    async = require('async'),
    Q = require('q');

//Q.longStackSupport = true;

var tiemposActualizacion = {
        sesionesCine: 10 * 60 * 60 * 1000
    },
    imageFileSizeLimit = 100000,
    noMovieDefaultImage = 'data:image/png;base64,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';

var KEY_HEADER = 'X-QEC-KEY',
    correctKey = 'D4m3L4sF0t0s';

//Cargo los modelos
var urls = {
    base: 'http://www.ecartelera.com',
    cinesCiudad: 'http://www.sensacine.com/cines/cines-en-',
    cine: 'http://www.ecartelera.com/cines/',
    cineIMDb: 'http://www.imdb.com/showtimes/cinema/ES/',
    pelicula: 'http://www.ecartelera.com/peliculas/'
};


//Inicio conexión de mongo
var dbCine = mongoose.createConnection(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {safe: true}
});

//Modo debug
dbCine.on('error', console.error.bind(console, 'Error conectando a MongoDB:'));
dbCine.on("connected", //console.log.bind(console, 'Conectado a MongoDB: Cine'));

//Modelos
var Pelicula = dbCine.model('Pelicula', modelos.peliculaSchema),
    Provincia = dbCine.model('Provincia', modelos.provinciaSchema),
    Ciudad = dbCine.model('Ciudad', modelos.ciudadSchema),
    Cine = dbCine.model('Cine', modelos.cineSchema),
    Sesion = dbCine.model('Sesion', modelos.sesionSchema),
    Correlation = dbCine.model('Correlation', modelos.cineCorrelationSchema);

module.exports = function (app) {

    /**
     * Obtiene el listado de provincias y ciudades
     */
    var getCiudades = function (req, res) {
        res.set({'Content-Type': 'application/json; charset=utf-8'});
        var response = {
            provincias: null,
            error: ''
        };
        //console.log('Hola ciudades');

        //Consulto a mongo
        mongo.getProvincias(function (error, provincias) {
            if (error) {
                response.error = 'Se produjo un error al buscar las provincias';
                res.status(500);
            } else if (provincias === null || provincias.length === 0) {
                response.error = 'No se han encontrado provincias';
                res.status(404);
            } else {
                response.provincias = provincias;
            }

            //Respuesta
            res.json(response);
            //console.log("He respondido pero sigo haciendo cosas");
        });
    };


    /**
     * Obtiene el listado de cines de una ciudad
     */
    var getCinesCiudad = function (req, res) {
        res.set({'Content-Type': 'application/json; charset=utf-8'});
        var ciudadMD5 = req.params.ciudadId,
            response = {
                cines: null,
                error: ''
            };

        //console.log('Hola cinesCiudad');

        //Obtengo los datos de la ciudad primero
        mongo.getCiudad(ciudadMD5, function (error, provincia) {
            //console.log(provincia);

            //Si no encontré la ciudad
            if (error) {
                response.error = 'Se produjo un error buscando la ciudad';
                res.status(500).json(response);
            } else if (provincia.length === 0) {
                response.error = 'No se ha encontrado la ciudad';
                res.status(404).json(response);
            } else {
                //console.log('Voy a por los cines de la ciudad');
                //Si encontré la ciudad, saco sus cines
                mongo.getCinesCiudad(ciudadMD5, function (error, cines) {
                    //console.log(cines);
                    if (error) {
                        response.error = 'Se produjo un error buscando los cines';
                        res.status(500);
                    } else if (cines === null || cines.length === 0) {
                        response.error = 'No se han encontrado los cines';
                        res.status(404);
                    } else {
                        response.cines = cines;
                        //console.log(response);
                    }

                    //respondo
                    res.json(response);
                });
            }
        });
    };

    /**
     * Obtiene la información del cine, sus películas y sesiones
     */
    var getCine = function (req, res) {
        var returnPhotos = checkKey(req.get(KEY_HEADER));

        res.set({'Content-Type': 'application/json; charset=utf-8'});
        var cineMD5 = req.params.cineId,
            response = {
                cine: null,
                error: ''
            };

        //console.log('Hola cine');

        mongo.getCine(cineMD5, function (err, cine) {
            if (err) {
                response.error = 'Se produjo un error buscando el cine';
                res.status(500).json(response);
            } else if (cine === null || cine.length === 0) {
                response.error = 'No se ha encontrado el cine';
                res.status(404).json(response);
            } else {
                //Miro si se actualizó el cine hace menos de 10 horas
                var now = new Date().getTime();
                if (now <= (cine.actualizado + tiemposActualizacion.sesionesCine)) {
                    //console.log('No tengo que actualizar el cine');
                    //Está actualizado Voy a sacar las películas asociadas a cada sesión del cine
                    async.mapSeries(cine.sesiones, mongo.getPeliculaSesion,
                        function (err, sesiones) {
                            if (err) {
                                res.status(500).json(response);
                            } else {
                                //console.log('Termino y respondo');

                                //Miro si envío fotos o no
                                if (!returnPhotos) {
                                    sesiones = stripPhotosFromSessions(sesiones);
                                }

                                //Convierto el objeto de mongoose en un json
                                response.cine = cine.toJSON();
                                response.cine.sesiones = sesiones;

                                res.json(response);
                            }
                        });
                    //response.cine = cine;
                    //res.json(response);
                } else {
                    //console.log('Tengo que actualizar el cine');
                    //actualizo el cine antes de enviar la respuesta
                    mongo.updateCine(cine, function (error, cineUpdated) {
                        //console.log('Cine updateao');
                        //console.log(cineUpdated);
                        if (error) {
                            response.error = 'Se produjo un error al actualizar la información del cine';
                            res.status(500).json(response);
                        } else {
                            //Voy a sacar las películas asociadas a cada sesión del cine
                            async.mapSeries(cineUpdated.sesiones, mongo.getPeliculaSesion,
                                function (err, sesiones) {
                                    if (err) {
                                        res.status(500).json(response);
                                    } else {
                                        //console.log('Termino y respondo');

                                        //Miro si envío fotos o no
                                        if (!returnPhotos) {
                                            sesiones = stripPhotosFromSessions(sesiones);
                                        }

                                        //Convierto el objeto de mongoose en un json
                                        response.cine = cineUpdated.toJSON();
                                        response.cine.sesiones = sesiones;

                                        res.json(response);
                                    }
                                });
                        }
                    });
                }
            }
        });
    };

    /**
     * Obtiene un listado de películas
     */
    var getPeliculas = function (req, res) {
        res.set({'Content-Type': 'application/json; charset=utf-8'});

        var response = {
            peliculas: null,
            error: ''
        };

        //Cojo las pelis
        mongo.getPeliculas(function (error, peliculas) {
            //console.log(peliculas);
            if (error) {
                response.error = 'Se produjo un error al buscar las películas';
                res.status(500).json(response);
            } else if (peliculas === null || peliculas.length === 0) {
                //No tengo pelis
                response.peliculas = [];
                res.json(response);
            } else {
                response.peliculas = peliculas;
                res.json(response);
            }
        });
    };

    /**
     * Obtiene la información de la película
     */
    var getPelicula = function (req, res) {
        var returnPhotos = checkKey(req.get(KEY_HEADER));

        res.set({'Content-Type': 'application/json; charset=utf-8'});

        var peliculaMD5 = md5(req.params.peliculaSourceId),
            peliculaId = req.params.peliculaSourceId,
            response = {
                pelicula: null,
                error: ''
            };

        //console.log('Hola pelicula');

        //Cojo la peli
        mongo.getPelicula(peliculaMD5, function (error, pelicula) {
            //console.log(pelicula);
            if (error) {
                response.error = 'Se produjo un error al buscar la película';
                res.status(500).json(response);
            } else if (pelicula === null || pelicula.length === 0) {
                //No tengo la peli así que he de buscarla
                mongo.updatePelicula({_id: peliculaMD5, peliculaId: peliculaId}, function (error, updatedPelicula) {
                    if (error) {
                        response.error = 'Se produjo un error al actualizar la película';
                        res.status(500).json(response);
                    } else if (updatedPelicula === null || updatedPelicula.length === 0) {
                        response.error = 'No se ha encontrado la peli';
                        res.status(404).json(response);
                    } else {
                        //A ver si envío foto
                        if (!returnPhotos) {
                            updatedPelicula.imagen = noMovieDefaultImage;
                        }

                        response.pelicula = updatedPelicula;
                        res.json(response);
                    }
                });
            } else {
                //A ver si envío foto
                if (!returnPhotos) {
                    pelicula.imagen = noMovieDefaultImage;
                }
                response.pelicula = pelicula;
                res.json(response);
            }
        });
    };

    //Los paths
    app.get('/api/cine/ciudades', getCiudades);                     //Provincias y ciudades
    app.get('/api/cine/ciudades/:ciudadId', getCinesCiudad);        //Cines de una ciudad
    app.get('/api/cine/cines/:cineId', getCine);                    //Películas y sesiones de un cine
    app.get('/api/cine/peliculas', getPeliculas);                   //Películas, solo títulos
    app.get('/api/cine/peliculas/:peliculaSourceId', getPelicula);  //Película
    //app.get('/api/cine/peliculas/:ciudadId', getPeliculasCiudad); //Películas y sesiones de toda la ciudad

    /** HELPERS **/
    var mongo = {
        //Obtengo el listado de provincias y ciudades
        getProvincias: function (callback) {
            Provincia
                .find()
                .select('-sortfield')
                .sort('sortfield')
                .exec(function (err, provincias) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Encontré las provincias');
                        callback(null, provincias);
                    }
                });
        },

        //Obtengo la ciudad
        getCiudad: function (idCiudad, callback) {
            Provincia
                //.find({ciudades: {_id: idCiudad}})
                .aggregate([
                    {$unwind: "$ciudades"},
                    {$match: {"ciudades._id": idCiudad}},
                    {$limit: 1}
                ])
                .exec(function (err, provinciaCiudad) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Encontré la ciudad');
                        callback(null, provinciaCiudad);
                    }
                });
        },

        //Obtengo el cine
        getCine: function (idCine, callback) {
            Cine
                .findOne({_id: idCine})
                .exec(function (err, cine) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Encontré el cine');
                        callback(null, cine);
                    }
                });
        },

        //Obtengo las pelis
        getPeliculas: function (callback) {
            Pelicula
                .find()
                .select('titulo peliculaId -_id')
                .sort('titulo')
                .exec(function (err, peliculas) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Encontré las pelis');
                        callback(null, peliculas);
                    }
                });
        },

        //Obtengo la película
        getPelicula: function (idPelicula, callback) {
            //console.log(idPelicula);
            Pelicula
                .findOne({_id: idPelicula})
                .exec(function (err, pelicula) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Devuelvo la peli de Mongo');
                        callback(null, pelicula);
                    }
                });
        },

        //Actualizo una pelicula
        updatePelicula: function (movie, callback) {
            //console.log('    Actualizando la peli');
            //Pido la pelicula
            request(urls.pelicula + movie.peliculaId, function (err, response, body) {
                if (err) {
                    console.error(err);
                    callback(err);
                } else {
                    //console.log('    Vamos a coger el body');
                    var $ = cheerio.load(body),
                        texto = '',
                        patrones = {
                            tituloOriginal: /Título original/,
                            anno: /Año/,
                            pais: /País/,
                            duracion: /Duración/,
                            genero: /Género/,
                            estudio: /Estudios/,
                            estreno: /España/
                        };

                    //Título
                    movie.titulo = $('h1 span[itemprop="name"]').text();

                    //Ficha de la peli
                    $('div.infoc2 p').each(function () {
                        var aux = '';
                        //Cojo el contenido de la línea
                        texto = $(this).text();

                        if (patrones.tituloOriginal.test(texto)) {
                            movie.tituloOriginal = texto.replace(/Título original: /i, '');
                        }
                        else if (patrones.anno.test(texto)) {
                            movie.anno = parseInt(texto.replace(/Año: /i, ''));
                        }
                        else if (patrones.pais.test(texto)) {
                            aux = texto.replace(/País: /i, '');
                            movie.pais = toTrimArray(aux);
                        }
                        else if (patrones.duracion.test(texto)) {
                            aux = texto.replace(/Duración: /i, '');
                            aux = aux.replace(/minutos/i, '');
                            movie.duracion = parseInt(aux);
                        }
                        else if (patrones.genero.test(texto)) {
                            aux = texto.replace(/Género: /i, '');
                            movie.genero = toTrimArray(aux);
                        }
                        else if (patrones.estudio.test(texto)) {
                            aux = texto.replace(/Estudios: /i, '');
                            movie.estudio = toTrimArray(aux);
                        }
                    });
                    //console.log('    Estreno');
                    //Estreno
                    $('div.cnt-dob p').each(function () {
                        texto = $(this).text();

                        if (patrones.estreno.test(texto)) {
                            movie.estreno = texto.replace(/España: /i, '');
                        }
                    });

                    //console.log('    Sinopsis');
                    //Sinopsis
                    var sinopsis = $('p[itemprop="description"]').text();
                    sinopsis = sinopsis.replace(/["]/g, "'");
                    //sinopsis = sinopsis.replace(/((Ocultar sinopsis completa...)|(Mostrar sinopsis completa))/, '');
                    sinopsis = sinopsis.replace(/Ocultar sinopsis completa.../, '');
                    sinopsis = sinopsis.replace(/Mostrar sinopsis completa/, '');
                    movie.sinopsis = sinopsis.trim();

                    //Director
                    movie.director = [];
                    $('div[itemprop="director"]').each(function () {
                        movie.director.push($(this).text().trim());
                    });

                    //console.log('    Reparto');
                    //Reparto
                    movie.reparto = [];
                    movie.repartoExtendido = [];
                    $('div[itemprop="actor"]').each(function () {
                        var actorName = $(this).find('p.colstart').text().trim();
                        movie.reparto.push(actorName);

                        var actorRole = $(this).find('p.colstarr').text().trim();
                        if (actorRole != '') {
                            actorName += ' (' + actorRole + ')';
                        }
                        movie.repartoExtendido.push(actorName);
                    });

                    //Thumbnail
                    var imgUrl = urls.base + $('img[itemprop="image"]').attr('src');
                    movie.imagen = imgUrl.replace(/_p\.jpg/, '-th.jpg');
                    downloadImageAsBase64(movie, function (error, movie) {
                        if (error) {
                            console.error(error);
                            callback(error);
                        } else {
                            //Ya tengo todo así que salvo en mongo
                            var peli = new Pelicula(movie);
                            peli.save();

                            //console.log('    Ya tengo todo de la peli, callback');
                            //Devuelvo
                            callback(null, movie);
                        }
                    });
                }
            });
        },

        //Obtiene la información de la peli de una sesión de cine
        getPeliculaSesion: function (sesion, callback) {
            //console.log('Cojo la peli de una de las sesiones: ' + sesion.peliculaId);
            //Miro si está en mongo y si no la tengo que descargar
            mongo.getPelicula(sesion._idPelicula, function (error, pelicula) {
                if (error) {
                    callback(error);
                } else if (pelicula === null) {
                    //console.log('...pero resulta que no tengo la peli, la buscare');
                    //No tengo la peli en mongo así que la pido
                    mongo.updatePelicula({_id: sesion._idPelicula, peliculaId: sesion.peliculaId},
                        function (error, updatedMovie) {
                            //console.log('    Ya he actualizado la peli de la sesión');
                            //console.log(sesion);
                            //console.log(updatedMovie);
                            if (error) {
                                callback(error);
                            } else if (updatedMovie === null) {
                                callback('No se encontró la película');
                            } else {
                                callback(null, mergeObj(sesion, updatedMovie));
                            }
                        });
                } else {
                    //La encontré, devuelvo la sesión completa con la info de la peli
                    callback(null, mergeObj(sesion, pelicula));
                }
            });
        },

        //Lista de cines de una ciudad
        getCinesCiudad: function (idCiudad, callback) {
            Cine
                .aggregate([
                    {$match: {"_idCiudad": idCiudad}}
                ])
                .exec(function (err, cinesCiudad) {
                    if (err) {
                        console.error(err);
                        callback(err);
                    } else {
                        //console.log('Encontré los cines de la ciudad');
                        callback(null, cinesCiudad);
                    }
                });
        },

        //Actualizo un cine y devuelve su información actualizada
        updateCine: function (cine, callback) {
            //console.log(cine);

            //Pido los datos del cine a la web
            request(urls.cine + cine.cineId, function (err, response, body) {
                if (err) {
                    console.error(err);
                    callback(err);
                } else {
                    var $ = cheerio.load(body), direccion = '', codigoPostal, coordLatitud,
                        telefono = '', precio = '', coordLongitud, sesiones = [];

                    //Voy a sacar los datos del cine
                    var direction = $('p.direction'),
                        prices = $('p.prices').text(),
                        patron = /(.+), CP([0-9]+)/;

                    //Dirección y cp
                    var res = patron.exec(direction.text());
                    if (res !== null) {
                        direccion = res[1];
                        codigoPostal = parseInt(res[2]);
                    }

                    //Coords
                    var coords = direction.find('a').attr('onclick');
                    patron = /displayMap\(([0-9\-\.]+), ([0-9\-\.]+)\)/;
                    res = patron.exec(coords);
                    if (res !== null) {
                        coordLatitud = parseFloat(res[1]);
                        coordLongitud = parseFloat(res[2]);
                    }

                    //Telefono y precios
                    prices = prices.split('|');
                    var l = prices.length;
                    if (l >= 2) {
                        telefono = prices[0];
                        for (var i = 1; i < l; i++) {
                            precio += prices[i];
                        }
                    }

                    //Si tengo la dirección del cine de IMDB lo saco de ahí
                    if (cine.imdbId !== null) {
                        //console.log('Saco la sesión de IMDb');
                        request(urls.cineIMDb + cine.imdbId + '/ES/' + codigoPostal, function (err2, response2, body2) {
                            if (err2) {
                                console.error(err2);
                                callback(err2);
                            } else {
                                var $2 = cheerio.load(body2),
                                    sesionesPartial = [];

                                //console.log('Consulto: ' + urls.cineIMDb + cine.imdbId + '/ES/' + cine.codigoPostal);
                                //console.log(body2);

                                //Saco las sesiones de la web de IMDB
                                $2('div[itemtype="http://schema.org/Movie"]').each(function (indx, sesionIMDB) {
                                    //console.log('Una sesión.');
                                    //console.log($(sesionIMDB).html());

                                    var showtime = $2(sesionIMDB).find('div.info').find('div.showtimes'),
                                        titIMDb = $2(sesionIMDB).find('div.info').find('h3').find('a[itemprop="url"]'),
                                        horas = [];

                                    showtime.each(function (ix, elem) {
                                        //console.log('elemento: ' + $2(elem).text());
                                        var auxHoras = $2(elem).text();
                                        auxHoras = auxHoras.split('|');

                                        auxHoras.forEach(function (hora) {
                                            horas.push(hora.trim());
                                        });
                                    });

                                    //console.log('Extraigo id: ' + extractIMDBId(titIMDb.attr('href')));
                                    //console.log('Horas: ');
                                    //console.log(horas);

                                    sesionesPartial.push({
                                        peliculaIMDbId: extractIMDBId(titIMDb.attr('href')),
                                        horarios: convertIMDbHours(horas)
                                    });
                                });

                                //console.log('Tengo estas parciales: ');
                                //console.log(sesionesPartial);

                                //Por cada sesiones Partial tengo que encontrar el id de la peli en mi Mongo
                                async.map(sesionesPartial, getIMDbIdFromMongo, function (err, results) {
                                    if (err) {
                                        //console.log('Error al obtener el imdb de una peli en mongo: ' + err);
                                    } else {
                                        //console.log('No error así que guardo sesion de peli: ' + cine.nombre);
                                        results.forEach(function (elemento) {
                                            if (elemento !== null) {
                                                sesiones.push({
                                                    _idPelicula: md5(elemento._idPelicula),
                                                    peliculaId: elemento.peliculaId,
                                                    horarios: elemento.horarios
                                                });
                                            }
                                        });
                                    }

                                    cine.direccion = direccion.trim();
                                    cine.codigoPostal = codigoPostal;
                                    cine.coordLatitud = coordLatitud;
                                    cine.coordLongitud = coordLongitud;
                                    cine.telefono = telefono.trim();
                                    cine.precio = precio.trim();
                                    cine.sesiones = sesiones;
                                    cine.actualizado = new Date().getTime();

                                    //Guardo en mongo
                                    cine.save();
                                    callback(null, cine);
                                });
                            }
                        });
                    } else {
                        //console.log('Saco la sesión de eCartelera');
                        //En otro caso, lo saco de ecartelera
                        $('div.lfilmbc').each(function () {
                            var idPeli = $(this).find('h4').find('a').attr('href');
                            idPeli = extractIdPelicula(idPeli);


                            var multiplesessions = $(this).find('p[itemprop="startDate"]'),
                                horas = [];

                            //console.log("Sesiones que hay: " + multiplesessions.length);
                            //console.log(multiplesessions);
                            multiplesessions.each(function (index, element) {
                                //console.log("Una sesion " + index);
                                var hors = $(element).text();


                                hors = hors.split('|');

                                hors.forEach(function (hora) {
                                    //console.log("Hora: " + hora);
                                    horas.push(hora.trim())
                                });
                            });

                            //var sess = $(this).find('p[itemprop="startDate"]').text(),
                            //    horas = [];

                            /*console.warn('Sesiones....');
                             //console.log(sess);
                             //console.log($(this).find('p[itemprop="startDate"]'));

                             sess = sess.split('|');

                             sess.forEach(function (sesion) {
                             horas.push(sesion.trim())
                             });*/

                            sesiones.push({
                                _idPelicula: md5(idPeli),
                                peliculaId: idPeli,
                                horarios: horas
                            });
                        });

                        cine.direccion = direccion.trim();
                        cine.codigoPostal = codigoPostal;
                        cine.coordLatitud = coordLatitud;
                        cine.coordLongitud = coordLongitud;
                        cine.telefono = telefono.trim();
                        cine.precio = precio.trim();
                        cine.sesiones = sesiones;
                        cine.actualizado = new Date().getTime();

                        //Guardo en mongo
                        cine.save();
                        callback(null, cine);
                    }
                }
            });
        }
    };


};

//Saca de mongo datos a partir de un id de IMDb
function getIMDbIdFromMongo(sess, callback) {
    //console.log('Llamada a getIMDbIdFromMongo: ');
    //console.log(sess);
    Pelicula.findOne({"imdbId": sess.peliculaIMDbId}).exec(function (err, peli) {
        if (err) {
            //console.log('Error al encontrar la parcial: ' + sess.peliculaIMDbId + ' en mongo.');
            callback(err);
        } else {
            if (peli !== null) {
                //peli = peli[0];
                //console.log('Encontré la parcial ' + sess.peliculaIMDbId + ' en mongo.');
                //console.log(peli);
                callback(null, {
                    _idPelicula: peli._id,
                    peliculaId: peli.peliculaId,
                    horarios: sess.horarios
                });
            } else {
                //console.log('No encontré la parcial: ' + sess.peliculaIMDbId + ' en mongo.');
                callback(null, null);
            }
        }
    });
}

//Extrae el id de la peli de un enlace http://www.ecartelera.com/peliculas/the-water-diviner/ que es the-water-diviner
function extractIdPelicula(href) {
    var patt = /(\/peliculas\/)(.+)(\/)/;

    var res = patt.exec(href);

    if (res !== null) {
        return res[2];
    } else {
        return null;
    }
}


function extractIMDBId(href) {
    var patt = /(.*\/)(tt[0-9]+)(\/.*)/;

    var res = patt.exec(href);

    if (res !== null) {
        return res[2];
    } else {
        return null;
    }
}

//Descarga una imagen como base64
var downloadImageAsBase64 = function (movie, callback) {
    //console.log("Descargo thumb");
    request(
        {url: movie.imagen, encoding: 'binary'},
        function onImageResponse(error, imageResponse, imageBody) {
            if (error) {
                callback(error);
            }

            var imageType = imageResponse.headers['content-type'],
                size = imageResponse.headers['content-length'];

            //Compruebo que la imagen no sobrepasa los límites
            if (size > imageFileSizeLimit) {
                callback(null, noMovieDefaultImage);
            } else {
                var base64 = new Buffer(imageBody, 'binary').toString('base64');
                movie.imagen = 'data:' + imageType + ';base64,' + base64;

                //Devuelvo el objeto movie con la imagen en base 64
                callback(null, movie); // First param indicates error, null=> no error
            }
        }
    );
};

//Coge una cadena separada por comas y la convierte a array trimeado
function toTrimArray(cadena) {
    var resultado = [];
    cadena = cadena.split(',');

    cadena.forEach(function (elemento) {
        resultado.push(elemento.trim());
    });
    return resultado;
}

//Combina una sesion con una peli
function mergeObj(sesion, pelicula) {
    var merged = {
        _idPelicula: sesion._idPelicula,
        peliculaId: sesion.peliculaId,
        horarios: sesion.horarios,
        titulo: pelicula.titulo,
        tituloOriginal: pelicula.tituloOriginal,
        estreno: pelicula.estreno,
        anno: pelicula.anno,
        duracion: pelicula.duracion,
        pais: pelicula.pais,
        genero: pelicula.genero,
        estudio: pelicula.estudio,
        sinopsis: pelicula.sinopsis,
        director: pelicula.director,
        reparto: pelicula.reparto,
        repartoExtendido: pelicula.repartoExtendido,
        imagen: pelicula.imagen
    };

    //console.log('      ++ Mergeado');
    //console.log(merged);
    return merged;
}

function checkKey(key) {
    if (key !== undefined && key === correctKey) {
        return true;
    } else {
        return false;
    }
}

function stripPhotosFromSessions(sesiones) {
    var newSesiones = [];
    sesiones.forEach(function (sesion) {
        sesion.imagen = noMovieDefaultImage;
        newSesiones.push(sesion);
    });
    return newSesiones;
}

//Convierte las horas de 5:30 a 17:30.
function convertIMDbHours(horas) {
    var salida = [], doce = false;

    horas.forEach(function (hora) {
        //Si tiene pm entonces empiezo a reemplazar
        if (hora.indexOf('pm') > -1) {
            doce = false;
        }

        if (!doce) {
            hora = hora.replace(' pm', '');
            hora = hora.split(':');
            //console.log(hora);
            //A ver si la siguiente hora se pasaría de las doce
            if (num == 0 || num == 11) {
                doce = true;
            }

            var num = parseInt(hora[0]) + 12;

            salida.push(num + ':' + hora[1]);
        } else {
            salida.push(hora);
        }
    });

    return salida;
}

//thumb: http://www.ecartelera.com/carteles/9500/9546/001_p.jpg -> http://www.ecartelera.com/carteles/9500/9546/001-th.jpg

function dbCineDisconnect() {
    mongoose.disconnect();
}

process.on('exit', dbCineDisconnect);
process.on('SIGINT', dbCineDisconnect);
process.on('SIGTERM', dbCineDisconnect);