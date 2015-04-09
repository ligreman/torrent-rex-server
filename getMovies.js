var request = require('request'),
    cheerio = require('cheerio'),
    mongoose = require('mongoose'),
    md5 = require('MD5'),
    async = require('async'),
    Q = require('q'),
    http = require('http');

var url = 'http://www.sensacine.com/peliculas/en-cartelera/cines',
    params = '/?page=', pages = [], numPages = 0, urls = [],
    retries = 2, moviesAlreadyInserted = [], countMoviesInserted = 0, countMoviesDupped = 0,
    moviesInWeb = [], moviesNews = [];

//Conecto a mongo
mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/cine', {
    db: {
        safe: true
    }
});

//Cargo los modelos
var modelos = require('./models/models.js');

//Cojo la primera página e inicio el proceso
request(url, function (err, resp, body) {
    if (err || resp.statusCode !== 200) {
        console.log('Se produjo un error');

        throw err;
    }

    //Añado el body actual
    pages.push(body);

    //Saco las páginas que tiene
    var $ = cheerio.load(body);
    numPages = $('div.pager ul li').last().children('a').text();

    //Genero las urls de las páginas
    for (var i = 2; i <= numPages; i++) {
        urls.push(url + params + i);
    }

    //Inicio la obtención de las páginas
    iteratePages();
});

/***********************************************************************************/
/********************** OBTENCIÓN DE LAS PÁGINAS ***********************************/
/***********************************************************************************/

//Iterador que va lanzando los retries para obtener las páginas
function iteratePages() {
    //Saco los body de cada página
    getPagesBodies(urls, function (resultado) {
        if (resultado === null) {
            console.log("Ha fallado una url en el iterador");
            //Ha fallado algo, reintento
            if (retries > 0) {
                retries--;
                setTimeout(iteratePages, 3000);
            } else {
                returnError('No se pudo obtener todas las páginas tras los reintentos.');
            }
        } else {
            console.log("Iterador correcto");
            //Todo OK
            resultado.forEach(function (cuerpo) {
                pages.push(cuerpo);
            });
            processPagesBodies(pages);

            //Ahora tengo en moviesInWeb los JSON de las películas
            compareMoviesWithMongo()
                .then(convertImagesToBase64).delay(2000)
                .then(obtainSinopsisAndCountry)
                .done(function () {
                    console.log("Películas nuevas encontradas en la web: " + moviesNews.length);
                    console.log("Películas insertadas en Mongo: " + countMoviesInserted);
                    console.log("Películas duplicadas: " + countMoviesDupped);
                    mongoose.disconnect();
                    console.log("Se terminó");
                    //Finalizo
                    process.exit();

                    //Elimino duplicados

                    //Guardo en base de datos
                    /*modelos.Pelicula.collection.insert(moviesNews, function (err, docs) {
                     if (err) {
                     console.error(err);
                     } else {
                     console.log("He insertado: " + docs.length);
                     }

                     mongoose.disconnect();
                     console.log("Se terminó");
                     //Finalizo
                     process.exit();
                     });*/

                    /*async.map(moviesNews, saveMovie, function (err, results) {
                     if (err) {
                     console.error(err);
                     } else {
                     console.log("");
                     }

                     mongoose.disconnect();
                     console.log("Se terminó");
                     //Finalizo
                     process.exit();
                     });*/

                    /*modelos.Pelicula.create(moviesNews, function (err) {
                     if (err) {
                     console.error(err);
                     }

                     mongoose.disconnect();
                     console.log("Se terminó");
                     //Finalizo
                     process.exit();
                     });*/
                });
        }
    });
}

var saveMovie = function (movie, callback) {
    var peli = new modelos.Pelicula(movie);

    peli.save(function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, results); // results[2] -> 'file3' body
        }
    });
};

//Map que va lanzando cada petición de obtención de cuerpo y responde cuando todas han terminado
function getPagesBodies(urls, callback) {
    //Voy sacando el body de cada página
    async.map(urls, getBody, function (err, results) {
        if (err) {
            callback(null);
        } else {
            callback(results); // results[2] -> 'file3' body
        }
    });
}

//Obtiene el cuerpo de una página concreta
var getBody = function (urlSource, callback) {
    request.get(urlSource, function (err, response, body) {
        if (err) {
            callback(err);
        } else {
            callback(null, body); // First param indicates error, null=> no error
        }
    });
};

/*
 var request = require('request').defaults({ encoding: null });

 request.get('http://tinypng.org/images/example-shrunk-8cadd4c7.png', function (error, response, body) {
 if (!error && response.statusCode == 200) {
 data = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
 console.log(data);
 }
 });
 */

/***********************************************************************************/
/*************** PROCESAMIENTO DE LOS BODIES ***************************************/
/***********************************************************************************/

//Procesa el HTML de los cuerpos para extraer información
function processPagesBodies(paginas) {
    var movies = [];

    var o = 1;
    paginas.forEach(function (pagina) {
        console.info("Pagina " + o);
        movies.push(parsePageBody(pagina));
        o++;
    });
}


//Parseador del body. Obtiene la información de cada película
function parsePageBody(body) {
    var ids = [];

    var $ = cheerio.load(body);
    $('div.data_box').each(function (i, elem) {
        var movie = {};

        var img = $(this).children('div').children('span').children('img');

        movie.titulo = img.attr('title');
        movie.imagen = img.attr('src');

        var content = $(this).children('div').children('div.content');

        movie.duracion = 0;
        movie.peliculaId = parseMovieId(content.children('div').children('h2').children('a').attr('href'));
        //Calculo el id
        movie._id = md5(movie.peliculaId);

        //Si consigo obtener el id continuo haciendo cosas
        if (movie.peliculaId !== null) {
            content.children('ul').find('li').each(function () {
                var span = $(this).children('span');
                var li = $(this);

                var elemento = span.text();
                elemento = elemento.trim();

                switch (elemento) {
                    case 'Estreno':
                        var estreno = span.next('div').text().replace(/\n/g, '');
                        estreno = parseEstrenoDate(estreno);
                        movie.estreno = estreno.fecha;
                        movie.duracion = estreno.duracion;
                        movie.anno = estreno.anno;
                        break;
                    case 'Director':
                        var directors = [];
                        span.next('div').find('span').each(function () {
                            directors.push($(this).text());
                        });
                        movie.director = directors;
                        break;
                    case 'Reparto':
                        var reparto = [];
                        span.next('div').find('span').each(function () {
                            reparto.push($(this).text());
                        });
                        movie.reparto = reparto;
                        break;
                    case 'Género':
                        var genero = [];
                        li.find('span[itemprop="genre"]').each(function () {
                            genero.push($(this).text());
                        });
                        movie.genero = genero;
                        break;
                }
            });
        }

        //console.log(movie);
        moviesInWeb.push(movie);
    });
}

//Me guardo los objetos de las películas de Mongo para saber cuál tengo que guardar
function compareMoviesWithMongo() {
    var ids = [];
    console.log("comparo");
    //Cojo las peliculas de base de datos
    var defer = Q.defer();
    modelos.Pelicula.find().select('_id').exec(function (err, peliculas) {
        if (err) {
            defer.reject(new Error(err));
        }
        console.log("ya tengo mongo");

        peliculas.forEach(function (pelicula) {
            //moviesInMongo.push(pelicula._id);
            ids.push(pelicula._id);
        });
        console.log(ids);

        //Comparo con las que encontré en la web para saber las nuevas
        var peli;
        for (index in moviesInWeb) {
            if (moviesInWeb.hasOwnProperty(index)) {
                peli = moviesInWeb[index];
                //Si no está la peli en mongo es nueva
                if (ids.indexOf(peli._id) === -1) {
                    moviesNews.push(peli);
                }
            }
        }
        //console.log("nuevas movies: " + moviesInWeb.length);

        defer.resolve('');
    });

    return defer.promise;
}

function convertImagesToBase64() {
    var def = Q.defer();
    //Crea una cadena de descargas de imagenes
    //Por cada movie nuevo llamo al deferred
    //Voy sacando el body de cada página
    /*var prueba = [];
     prueba.push(moviesNews.pop());
     prueba.push(moviesNews.pop());
     prueba.push(moviesNews.pop());
     moviesNews = prueba;*/
    /*
     console.log("--------");
     console.log("--------");
     console.log(moviesInWeb);
     console.log("--------");
     console.log("--------");*/

    async.map(moviesNews, downloadImageAsBase64, function (err, results) {
        if (err) {
            def.reject(err);
            //throw err;
        } else {
            console.log("fin iterador");
            moviesNews = results;
            //console.log(moviesInWeb);
            def.resolve();
        }
    });

    return def.promise;
}

function downloadImageAsBase64(movie, callback) {
    console.log("Descargo imagen");
    request(
        {url: movie.imagen, encoding: 'binary'},
        function onImageResponse(error, imageResponse, imageBody) {
            if (error) {
                callback(error);
                //throw error;
            }

            var imageType = imageResponse.headers['content-type'];
            var base64 = new Buffer(imageBody, 'binary').toString('base64');
            movie.imagen = 'data:' + imageType + ';base64,' + base64;

            //Devuelvo el objeto movie con la imagen en base 64
            callback(null, movie); // First param indicates error, null=> no error
        }
    );
}

function obtainSinopsisAndCountry() {
    var defer = Q.defer();

    async.mapSeries(moviesNews, getSinopsisAndCountry, function (err, results) {
        if (err) {
            defer.reject(err);
            //throw err;
        } else {
            console.log("fin iterador");
            moviesNews = results;
            //console.log(moviesInWeb);
            defer.resolve();
        }
    });

    return defer.promise;
}

var getSinopsisAndCountry = function (movie, callback) {
    console.log("Pillo peli: " + movie.titulo + " (" + md5(movie.peliculaId) + ")");
    //Accedo a la página de la peli para sacar sus datos
    var urlBase = 'http://www.sensacine.com/peliculas/pelicula-';
    request(urlBase + movie.peliculaId, function (error, response, body) {
            if (error) {
                callback(error);
                //throw error;
            }

            var $ = cheerio.load(body),
                paises = [];

            $('span.lighten').each(function () {
                var texto = $(this).text();
                texto = texto.trim();

                if (texto == 'País') {
                    $(this).parent('th').next('td').find('span').each(function () {
                        //console.log($(this).text());
                        paises.push($(this).text().replace(/\n/g, ''));
                    });
                }
            });

            movie.sinopsis = $('h2#synopsys_details').parent('div').next('div').find('p').text().replace(/\n/g, '').replace(/"/g, "'");
            movie.pais = paises;

            //console.log(movie);

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
                callback(null, movie);
            }

            //Devuelvo el objeto movie
            //callback(null, movie); // First param indicates error, null=> no error
        }
    );
};

/*************************************************************/
/*************** PARSEADORES *********************************/
/*************************************************************/
function parseMovieId(enlace) {
    var patron = /[0-9]+/;
    var resultado = patron.exec(enlace);
    return resultado[0];
}

function parseEstrenoDate(estreno) {
    //console.log(estreno);
    var patron = /([0-9]{2}\/[0-9]{2}\/)([0-9]{4})[ ]*(\(([0-9]*)h([0-9]*)min\))?/;
    var resultado = patron.exec(estreno);
    //["02/03/2015(1h45min)", "02/03/", "2015", "(1h45min)", "1", "45"]
    return {
        fecha: resultado[1] + resultado[2],
        anno: resultado[2],
        duracion: aMinutos(resultado[4], resultado[5])
    };
}

//Convierte una cadena 2h45min a minutos
function aMinutos(horas, minutos) {
    if (horas === undefined || horas === null) {
        return 0;
    }

    horas = parseInt(horas);
    minutos = parseInt(minutos);

    minutos += horas * 60;
    return minutos;
}

/*************************************************************/
/*************** OTROS ***************************************/
/*************************************************************/

function returnError(error) {
    console.error(error);
}
