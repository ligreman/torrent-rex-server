'use strict';

var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('md5'),
    async = require('async'),
    events = require('events'),
//fs = require('fs'),
    Q = require('q');

var urlBase = 'http://www.ecartelera.com/peliculas/',
    urlIMDB = 'http://www.imdb.com/find?s=tt&q=',
    moviesAlreadyInserted = [], countMoviesInserted = 0, countMoviesDupped = 0, moviesDupped = [],
    imageFileSizeLimit = 100000,
    searchWithAnno = true,
    noMovieDefaultImage = 'data:image/png;base64,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';

//Gestor de eventos
var eventEmitter = new events.EventEmitter();

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {
        safe: true
    }
});

//Cargo los modelos
var modelos = require('./models/models.js');


//Saco las pelis que tengo en mongo
modelos.Pelicula.find().exec(function (err, peliculas) {
    if (err) {
        console.log("Error en mongo: " + err);
        mongoose.disconnect();
        process.exit();
    } else {
        var ids = [];
        //Saco los ids de las pelis que ya tengo en mongo
        peliculas.forEach(function (pelicula) {
            //moviesInMongo.push(pelicula._id);
            ids.push(pelicula._id);
        });
        eventEmitter.emit('checkNewMovies', ids);
    }
});

//Cojo las pelis de la web y comparo con mongo para guardar las nuevas
eventEmitter.on('checkNewMovies', function (idsMoviesInMongo) {
    //Cojo la página de las películas
    request(urlBase, function (err, resp, body) {
        if (err || resp.statusCode !== 200) {
            console.log('Se produjo un error');
            throw err;
        }

        //Saco el cuerpo
        var $ = cheerio.load(body), newMovies = [];

        //Saco las pelis
        $('a.item-block').each(function () {
            var thumb = $(this).find('img').attr('src');
            var idPelicula = extractIdPelicula($(this).attr('href'));
            var md5Id = md5(idPelicula);

            console.log('  -- Busco si tengo ya este md5: ' + md5Id + ' correspondiente a ' + idPelicula);

            //Busco en mongo este id y si no está lo marco como nueva peli
            if (idsMoviesInMongo.indexOf(md5Id) === -1) {
                console.log('  -- No lo tengo');
                newMovies.push({
                    _id: md5Id,
                    peliculaId: idPelicula,
                    imagen: thumb
                });
            }
        });

        //Obtengo las películas nuevas
        if (newMovies.length > 0) {
            eventEmitter.emit('getNewMovies', newMovies);
        } else {
            eventEmitter.emit('checkMongoMovies');
        }
    });
});


//Obtengo las películas nuevas
eventEmitter.on('getNewMovies', function (newMovies) {
    console.log('Películas nuevas en la web: ' + newMovies.length);

    //Cojo su thumbnail y datos
    downloadThumbnails(newMovies).delay(2000)
        .then(getAndSaveMoviesInformation)
        .catch(function (error) {
            console.log(error);
            throw error;
        })
        .done(function (movies) {
            console.log("Películas nuevas encontradas en la web: " + movies.length);
            console.log("Películas insertadas en Mongo: " + countMoviesInserted);
            console.log("Películas duplicadas: " + countMoviesDupped + ". Son:");
            console.log(moviesDupped);

            //buscar el imdb de las pelis que ya tengo en mongo y tienen ese campo null
            eventEmitter.emit('checkMongoMovies');
        });
});

eventEmitter.on('checkMongoMovies', function () {
    //Saco de mongo las pelis que tienen imdb null
    modelos.Pelicula.find({"imdbId": null}).exec(function (err, peliculas) {
        if (err) {
            console.log("Error al sacar las pelis de Mongo: " + err);
        } else {
            console.log("Busco los id de IMDb que me faltan en Mongo: " + peliculas.length);
            async.map(peliculas, getAndSaveImdbId, function (err, results) {
                if (err) {
                    console.log("Error al obtener el imdb de una peli: " + err);
                }

                eventEmitter.emit('checkMongoMoviesWithoutAnno');
            });
        }
    });

});

eventEmitter.on('checkMongoMoviesWithoutAnno', function () {
    searchWithAnno = false;
    //Saco de mongo las pelis que tienen imdb null
    modelos.Pelicula.find({"imdbId": null}).exec(function (err, peliculas) {
        if (err) {
            console.log("Error al sacar las pelis de Mongo: " + err);
        } else {
            console.log("Busco los id de IMDb que me faltan en Mongo, ahora sin el año: " + peliculas.length);
            async.map(peliculas, getAndSaveImdbId, function (err, results) {
                if (err) {
                    console.log("Error al obtener el imdb de una peli: " + err);
                }

                eventEmitter.emit('finalize');
            });
        }
    });

});

eventEmitter.on('finalize', function () {
    mongoose.disconnect();
    console.log("Se terminó");
    //Finalizo
    process.exit();
});

/*************************************************************/
/*************** FUNCIONES *********************************/
/*************************************************************/
//Descarga los thumnails de las pelis
var downloadThumbnails = function (newMovies) {
    var def = Q.defer();

    async.map(newMovies, downloadImageAsBase64, function (err, results) {
        if (err) {
            def.reject(err);
        } else {
            console.log("Fin de obtención de thumbnails");
            //moviesNews = results;
            def.resolve(results);
        }
    });

    return def.promise;
};

//Descarga una imagen como base64
var downloadImageAsBase64 = function (movie, callback) {
    console.log("Descargo thumb");
    request(
        {url: movie.imagen, encoding: 'binary'},
        function onImageResponse(error, imageResponse, imageBody) {
            if (error) {
                callback(error);
                //throw error;
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

//Obtengo la información de cada película
var getAndSaveMoviesInformation = function (newMovies) {
//function obtainSinopsisAndCountry() {
    var defer = Q.defer();

    async.mapSeries(newMovies, downloadMovie, function (err, movies) {
        if (err) {
            defer.reject(err);
            //throw err;
        } else {
            console.log("Fin de obtención de información de las películas");
            //moviesNews = results;
            //console.log(moviesInWeb);
            defer.resolve(movies);
        }
    });

    return defer.promise;
};

//Descarga la información de una película y la guarda en Mongo
var downloadMovie = function (movie, callback) {
    console.log("Pillo peli: " + movie._id + " (" + movie.peliculaId + ")");

    //Accedo a la página de la peli para sacar sus datos
    request(urlBase + movie.peliculaId, function (error, response, body) {
            if (error) {
                callback(error);
            }

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

            //Estreno
            $('div.cnt-dob p').each(function () {
                texto = $(this).text();

                if (patrones.estreno.test(texto)) {
                    movie.estreno = texto.replace(/España: /i, '');
                }
            });


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

            //Cojo de IMDB el id si lo encuentro
            request(urlIMDB + encodeURIComponent(movie.titulo), function (error2, response, body2) {
                if (!error2) {
                    //Saco el id de IMDB
                    var $2 = cheerio.load(body2);
                    //Cojo el primer resultado
                    var enlace = $2('table.findList').find('tr').first().find('td.result_text').find('a');
                    if (enlace != null) {
                        movie.imdbId = extractIdIMDB(enlace.attr('href'));
                        console.log('        Imdb ID: ' + movie.imdbId);
                    }
                } else {
                    console.log('        Error al extraer el ID de Imdb: ' + error2);
                }

                //Guardo en Mongo si no lo metí ya
                if (moviesAlreadyInserted.indexOf(movie._id) === -1) {
                    var peli = new modelos.Pelicula(movie);
                    peli.save(function (err) {
                        if (err) {
                            callback(err);
                            //throw err;
                        } else {
                            moviesAlreadyInserted.push(movie._id);
                            countMoviesInserted++;
                            callback(null, movie); // results[2] -> 'file3' body
                        }
                    });
                } else {
                    countMoviesDupped++;
                    moviesDupped.push(movie.titulo);
                    callback(null, movie);
                }
            });
        }
    );
};


//Obtiene el id de imdb de una peli
function getAndSaveImdbId(pelicula, callback) {
    var cadena = pelicula.titulo;

    if (searchWithAnno && pelicula.anno !== null) {
        cadena = cadena + ' ' + pelicula.anno;
    }

    request(urlIMDB + encodeURIComponent(cadena), function (error, response, body) {
        if (!error) {
            //Saco el id de IMDB
            var $2 = cheerio.load(body);

            //Cojo el primer resultado
            var enlace = $2('table.findList').find('tr').first().find('td.result_text').find('a'),
                imdbId = null;

            var temp = $2('table.findList').find('tr').first();
            //console.log(temp.html());

            if (enlace !== null) {
                //console.log('    Enlace no vacío: ' + enlace.attr('href'));
                imdbId = extractIdIMDB(enlace.attr('href'));
                //console.log('    extraido: ' + imdbId);
            }

            if (imdbId !== null) {
                pelicula.imdbId = imdbId;
                console.log('  Encontrado ID de IMDB de: ' + pelicula.titulo + ' (' + pelicula.imdbId + ')');
                //console.log(urlIMDB + encodeURIComponent(pelicula.titulo));
                //fs.writeFileSync(pelicula._id + ".txt", body);
            } else {
                console.log('  No encontré el id IMDB de: ' + pelicula.titulo);
                console.log('  ' + urlIMDB + encodeURIComponent(pelicula.titulo));
            }

            //Salvo en mongo
            modelos.Pelicula.collection.update({'_id': pelicula._id}, {$set: {'imdbId': pelicula.imdbId}});

            callback(null, pelicula);
        } else {
            console.log('Error al buscar el id IMDB de: ' + pelicula.titulo);
            callback(error);
        }
    });
}


/*************************************************************/
/*************** UTILES ***************************************/
/*************************************************************/

//Coge una cadena separada por comas y la convierte a array trimeado
function toTrimArray(cadena) {
    var resultado = [];
    cadena = cadena.split(',');

    cadena.forEach(function (elemento) {
        resultado.push(elemento.trim());
    });
    return resultado;
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

function extractIdIMDB(href) {
    var patt = /(.*\/)(tt[0-9]*)(\/.*)/;

    var res = patt.exec(href);

    if (res !== null) {
        return res[2];
    } else {
        return null;
    }
}