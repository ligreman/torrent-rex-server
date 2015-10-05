'use strict';

var txibitUtils = require('../utils/txibit.js');
var newpctUtils = require('../utils/newpct.js');

var request = require('request'),
    cheerio = require('cheerio'),
    http = require('http'),
    md5 = require('md5'),
    mongoose = require('mongoose'),
    modelos = require('../models/trex-models.js'),
    async = require('async'),
    levi = require('levenshtein'),
    events = require('events');

var urls = {
    'T': 'http://www.txibitsoft.com/',
    'N': 'http://www.newpct1.com/',
    'SN1': 'http://www.newpct1.com/',
    'SN': 'http://www.newpct.com/'
}, urlsTorrentDownload = {
    'T': 'http://www.txibitsoft.com/bajatorrent.php?id=',
    //'N': 'http://tumejorjuego.com/download/index.php?link=descargar-torrent/'
    'N': 'http://www.newpct1.com/descargar-torrent/',
    'SN1': 'http://www.newpct1.com/descargar-torrent/',
    'SN': 'http://www.newpct.com/torrents/'
};

var eventEmitter = new events.EventEmitter();

/*
 http://trex-lovehinaesp.rhcloud.com/api/trex/series/legends
 http://trex-lovehinaesp.rhcloud.com/api/trex/series/dig
 http://trex-lovehinaesp.rhcloud.com/api/trex/series/homeland
 http://trex-lovehinaesp.rhcloud.com/api/trex/series/house-of-cards

 http://trex-lovehinaesp.rhcloud.com/api/trex/series/transporter-la-serie

 http://trex-lovehinaesp.rhcloud.com/api/trex/series/true-detective
 http://trex-lovehinaesp.rhcloud.com/api/trex/series/vikingos
 */

//Inicio conexión de mongo
var dbTrex = mongoose.createConnection(process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME || 'mongodb://localhost/trex', {
    db: {safe: true}
});

//Modo debug
dbTrex.on('error', console.error.bind(console, 'Error conectando a MongoDB:'));
dbTrex.on("connected", console.log.bind(console, 'Conectado a MongoDB: Trex'));

//Modelos
var Serie = dbTrex.model('Serie', modelos.serieDetailSchema),
    SerieExtract = dbTrex.model('SerieExtract', modelos.serieExtractSchema),
    SeriesT = dbTrex.model('SeriesT', modelos.seriesTSchema),
    SeriesN = dbTrex.model('SeriesN', modelos.seriesNSchema);

module.exports = function (app) {

    /*************************************************************************/
    /********************* LISTENER EVENTOS GENERALES ************************/
    /*************************************************************************/

    //Envío una respuesta JSON
    eventEmitter.on('sendResponse', function (responseObject, responseJSON) {
        console.log("Envio respuesta");
        responseObject.set({
            'Content-Type': 'application/json; charset=utf-8'
        }).json(responseJSON);
    });

    //Envío un torrent como respuesta
    eventEmitter.on('sendTorrent', function (responseObject, disposition, content, responseTorrent) {
        responseObject.set({
            'Content-Type': content,
            'Content-Disposition': disposition
        });

        responseObject.write(responseTorrent);
        responseObject.end();
    });


    /*************************************************************************/
    /*************** MÉTODOS DEL WEBSERVICE **********************************/
    /*************************************************************************/

    //GET - Obtiene las series de los ficheros json
    var getSeries = function (req, res) {
        //var txbitFile = fs.readFileSync('jsons/series-t.json', 'utf-8'),
        //    newpctFile = fs.readFileSync('jsons/series-n.json', 'utf-8');
        console.log("Pido series");
        var response = {
            servers: [],
            error: ""
        };

        //saco de mongo los datos
        SeriesT.find({}, function (err, docs) {
            if (err) {
                response = {servers: null, error: "Se produjo un error"};
                res.send(response);
                throw "Error: 500";
            }
            console.log("Encuentro:");
            console.log(docs);

            response.servers = docs;
            eventEmitter.emit('sendResponse', res, response);
        });

        //response.servers.push(JSON.parse(txbitFile));
        //response.servers.push(JSON.parse(newpctFile));
    };

    //GET - Recoge y devuelve todos los torrents de esta serie identificada por su ID (md5 de la url)
    var getSerieById = function (req, res) {
        var idSerie = req.params.idSerie,
            quality = req.params.quality,
            response = {};

        updateSerie(idSerie, function (error, tempData) {
            console.log("TERMINO UPDATE");
            if (error !== null || tempData === null || tempData === undefined) {
                response = {torrents: null, error: "Se produjo un error"};
                res.send(response);
                throw "Error: 500";
            }

            console.log("TEMPDATA");
            console.log(tempData);
            var nombrecito = tempData.name;
            if (!nombrecito) {
                nombrecito = tempData.titleSmall;
            }

            //Quito duplicados según calidad o capitulos que no son de esta serie
            var finalTemporadas = removeExtrangeAndDuplicatedChapters(tempData.temporadas, tempData.name, quality);

            response = {
                torrents: finalTemporadas,
                metadata: generateTorrentsData(finalTemporadas, tempData.source),
                error: ""
            };

            console.log("La respuesta");
            console.log(response);

            //Respuesta
            eventEmitter.emit('sendResponse', res, response);
        });
    };

    //GET - Obtiene una serie via introducir la url
    var getSearchSerie = function (req, res) {
        var source = req.params.source,
            serie = req.params.serie,
            response = {}, serieUrl = '';

        if (source === 'SN') {
            serieUrl = 'todos-los-capitulos/series/' + serie + '/'; //http://www.newpct.com/
        } else if (source === 'SN1') {
            serieUrl = 'series/' + serie + '/'; //http://www.newpct1.com/
        } else {
            response = {torrents: null, error: "Se produjo un error"};
            res.send(response);
            throw "Error: 500";
        }

        //Obtengo el id de la serie
        var id = serie;//md5(source + serie);
        req.params.idSerie = id;

        console.log("Añado la serie: " + id);

        Serie.findOne({_id: id})
            .exec(function (err, serieMDB) {
                if (err) {
                    console.error("Paso algo");
                    console.error(err);
                    throw err;
                } else {
                    if (serieMDB === null) {
                        console.log("No tengo la serie aún");
                        //La guardo
                        var laSerie = {
                            _id: id,
                            source: source,
                            url: serieUrl,
                            name: capitalize(serie),
                            id: id
                        };
                        console.log("Genero una serie nueva");
                        console.log(laSerie);

                        var newSerie = new Serie(laSerie);
                        newSerie.save(function (err) {
                            if (err) {
                                throw err;
                            } else {
                                //Una vez salvada llamo a getSerie
                                getSerieById(req, res);
                            }
                        });
                    } else {
                        //directamente llamo a getSetie
                        getSerieById(req, res);
                    }
                }
            });
    };

    //GET - Obtiene los torrent de una búsqueda
    var getSearch = function (req, res) {
        var url = req.params.term, response = {};
        url = new Buffer(url, 'base64').toString('ascii');  //utf8
        url = urls['T'] + 'torrents.php?procesar=1&texto=' + encodeURI(url) + '&categorias=%27Cine%20Alta%20Definicion%20HD%27,%27Peliculas%27,%27Peliculas%20Castellano%27';

        var page = parseInt(req.params.pageSearch);
        url = url + '&pagina=' + page;

        request(url, function (err, resp, body) {
            if (err) {
                response = {
                    torrents: null,
                    error: "Se produjo un error"
                };

                res.send(response);
                throw err;
            }

            var $ = cheerio.load(body);

            //Cojo la lista torrents
            var innerTorrents = [];
            $('dl').each(function () {
                var header = $(this).find('dt a'),
                    titulo = header.text(),
                    categoria, idioma, tamano, count = 1;

                if (titulo) {
                    titulo = titulo.replace('�', 'ñ');
                }

                //Saco el id del torrent
                var torrentId = header.attr('href');
                torrentId = torrentId.split('/');
                torrentId = torrentId[2];

                $(this).find('li span').each(function () {
                    switch (count) {
                        case 1:
                            categoria = $(this).text();
                            break;
                        case 2:
                            idioma = $(this).text();
                            if (idioma) {
                                idioma = idioma.replace('�', 'ñ');
                            }
                            break;
                        case 3:
                            tamano = $(this).text();
                            break;
                    }
                    count++;
                });

                innerTorrents.push({
                    title: titulo,
                    id: torrentId,
                    category: categoria,
                    language: idioma,
                    size: tamano
                });
            });

            //La página última. primero miro si hay enlace "ir a última"
            var last = -1,
                list = $('ul.paginacion');

            //Si existe paginación
            if (list.length > 0) {
                list = list.find('li').last();
                var a = list.find('a');

                //Si tiene un a dentro o no...
                if (a.length > 0) {
                    var hh = a.attr('href');

                    hh = hh.match(/pagina=[0-9]+/gi);
                    if (hh !== undefined && hh !== null && hh !== '') {
                        hh = hh[0];
                        last = hh.replace('pagina=', '');
                    }
                } else {
                    last = list.text();
                }
            }

            //Preparo la respuesta
            response = {
                maxPages: parseInt(last),
                torrents: innerTorrents,
                error: ""
            };

            //Respuesta
            eventEmitter.emit('sendResponse', res, response);
        });
    };

    //Descargo un torrent de una serie y lo envío al plugin
    var getSeriesTorrent = function (req, res) {
        var idChapterToDownload = req.params.id,
            idSerie = req.params.idSerie,
            response = {}, chapterToDownload = null;

        //Pido el json de la serie
        updateSerie(idSerie, function (error, tempData) {
            if (error !== null || tempData === null) {
                response = {error: "Se produjo un error"};
                res.status(500).send(response);
                throw "Error: 500";
            }

            console.log("busco el torrent");
            //Busco el torrent concreto que quiero bajar
            var continuar = true;
            for (var index in tempData.temporadas) {
                if (continuar && tempData.temporadas.hasOwnProperty(index)) {
                    var temporadaChapters = tempData.temporadas[index];

                    temporadaChapters.forEach(function (chapter) {
                        if (chapter.id == idChapterToDownload) {
                            chapterToDownload = chapter;
                            continuar = false;
                        }
                    });
                }
            }

            console.log("Ya lo tengo lo descargo");
            console.log(chapterToDownload);
            //Ya tengo el capítulo a bajar así que dependiendo de la fuente lo bajo o tengo que hacer más cosas
            switch (chapterToDownload.source) {
                case 'T':
                    //Bajo el torrent
                    console.log("Torrent de txibit");
                    downloadTorrent(res, chapterToDownload.torrentId, chapterToDownload.title, chapterToDownload.source);
                    break;
                case 'N':
                case 'SN1':
                    //Para este caso primero tengo que coger la web del capitulo y el id del torrent de ahí
                    var url = urls['N'] + 'descarga-torrent/' + chapterToDownload.url;
                    console.log('Consulto la web primero: ' + url);
                    request(url, function (err, resp, body) {
                        if (err) {
                            response = {error: "Se produjo un error"};
                            res.send(response);
                            throw err;
                        }

                        var $ = cheerio.load(body);

                        //Cojo el id del torrent
                        //http://tumejorjuego.com/download/index.php?link=descargar-torrent/38604_salvando-a-grace---temp.3--/
                        var href = $('a.btn-torrent').attr('href');

                        //Extraigo el identificador de la serie
                        href = href.replace('http://tumejorjuego.com/download/index.php?link=descargar-torrent/', '');

                        console.log('Torrent de newpct');
                        downloadTorrent(res, href, chapterToDownload.title, chapterToDownload.source);
                    });
                    break;
                case 'SN':
                    //Para este caso primero tengo que coger la web del capitulo y el id del torrent de ahí
                    var url2 = urls['SN'] + chapterToDownload.url;

                    console.log('Consulto la web primero: ' + url2);
                    request(url2, function (err, resp, body) {
                        if (err) {
                            response = {error: "Se produjo un error"};
                            res.send(response);
                            throw err;
                        }

                        var $ = cheerio.load(body);

                        //Cojo el id del torrent
                        //http://tumejorserie.com/descargar/index.php?link=torrents/042969.torrent
                        var href = $('#content-torrent').find('a').attr('href');

                        //Extraigo el identificador de la serie
                        href = href.replace('http://tumejorserie.com/descargar/index.php?link=torrents/', '');

                        console.log('Torrent de newpct');
                        downloadTorrent(res, href, chapterToDownload.title, chapterToDownload.source);
                    });
                    break;
            }
        });
    };

    var getDirectTorrent = function (req, res) {
        var idTorrent = req.params.idTorrent,
            response = {}, ok = true;

        ok = downloadTorrent(res, idTorrent, 'custom', 'T');

        if (ok === false) {
            response = {error: "Se produjo un error II"};
            res.status(500).send(response);
            throw "Error: 500";
        }
    };

    //Las rutas
    app.get('/api/trex/series', getSeries);                         //Lista de series
    app.get('/api/trex/series/:idSerie/:quality?', getSerieById);   //Lista de temporadas y capítulos de una serie. Quality: low,high
    app.get('/api/trex/download/:idSerie/:id', getSeriesTorrent);   //Descarga de series de T y N

    app.get('/api/trex/searchSerie/:source/:serie/:quality?', getSearchSerie); //Añade serie por url. Source: SN - SN1. Serie: nombre-de-la-serie
    app.get('/api/trex/search/:term/:pageSearch', getSearch);
    app.get('/api/trex/download/:idTorrent', getDirectTorrent); //Descarga de torrents buscados

    //app.get('/api/trex/download/:id', downloadTorrent);
    //app.get('/api/trex/torrents/:categoryUrl/:source', getTorrents);


    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    // FUNCIONES AUXILIARES
    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------

    var updateSerie = function updateSerie(idSerie, callback) {

        //file = fs.readFileSync('jsons/series/' + idSerie + '.json', 'utf-8');

        //var content = JSON.parse(file);
        console.log('Busco: ' + idSerie);

        //Miro a ver si tengo la serie en mongo
        Serie.findOne({"_id": idSerie})
            .exec(function (err, serie) {
                console.log('Error?: ' + err);
                console.log(serie);


                if (err || serie === null) {
                    callback(null);
                    console.log("Error al buscar la serie en mongo: " + idSerie);
                    return null;
                } else {
                    //Encontré la serie
                    updateSerieContinue(serie, callback);
                }
            });
    };

    function updateSerieContinue(content, callback) {
        var temporadasResponse = {}, $url = '',
            date = new Date(), currentTime = date.getTime(), jsonTime;

        //Si el lastUpdate no han pasado 24 horas no actualizo y devuelvo el contenido del json este
        if (content.lastUpdate !== undefined) {
            jsonTime = parseInt(content.lastUpdate, 10);
        } else {
            jsonTime = 0;
        }
        console.log(content);

        //Si está actualizado y ya tengo los datos devuelvo lo del json
        if (content.seasons !== undefined && Object.keys(content.seasons).length && (currentTime < (jsonTime + 24 * 60 * 60 * 1000))) {
            console.log('No hace falta actualizar');
            callback(null, {
                temporadas: content.seasons,
                name: content.name,
                source: content.source
            });
            return null;
        }

        //Tengo que actualizar los datos
        $url = urls[content.source] + content.url;
        console.log($url);
//http://trex-lovehinaesp.rhcloud.com/api/trex/torrents/dG9ycmVudHMucGhwP3Byb2Nlc2FyPTEmY2F0ZWdvcmlhcz0nU2VyaWVzJyZzdWJjYXRlZ29yaWE9MTg2NA==/T
//http://trex-lovehinaesp.rhcloud.com/api/trex/torrents/torrents.php?procesar=1&categorias='Series'&subcategoria=1864/T
//series-hd/american-horror-story/

        request($url, function (err, resp, body) {
            if (err) {
                callback(null);
                return null;
            }

            var $ = cheerio.load(body);
            var innerTorrents = [], paginas = [], numpags, category;

            //Cojo la lista torrents dependiendo de la fuente. Txibitsoft
            if (content.source === 'T') {
                console.log("Es la pagina de txibit");

                //Saco el número de páginas que hay para poder procesarlas
                numpags = $('ul.paginacion li').length;
                category = 'Serie';

                console.log("Num pags: " + numpags);

                //Miro si hay más páginas o no
                if (numpags == 0) {
                    //No hay más
                    paginas.push({url: $url, type: category, request: request, cheerio: cheerio});
                } else {
                    $url = txibitUtils.generateTxibitSeriePage($url);

                    //Construyo los enlaces
                    for (var j = 1; j <= numpags; j++) {
                        paginas.push({url: $url + j, type: category, request: request, cheerio: cheerio});
                    }
                }
                console.log('Paginas');
                console.log(paginas);

                //Cojo la información de las páginas
                async.map(paginas, txibitUtils.extractTxibitChapters, function (err, results) {
                    if (err) {
                        console.log('Error al obtener los capitulos de txibit: ' + err);
                    }

                    //Tengo en results un array de arrays url + cabecera
                    console.log("RESULTADOOOOOOOS");
                    console.log(results);

                    //Por cada result voy sacando los innerTorrents
                    results.forEach(function (pageTorrents) {
                        console.log("UN PAGETORRENT");
                        console.log(pageTorrents);
                        innerTorrents = innerTorrents.concat(pageTorrents);
                    });

                    console.log("Los torrents");
                    console.log(innerTorrents);
                    temporadasResponse = txibitUtils.parseTorrentsTxibitsoft(innerTorrents, md5);
                    console.log("Las temporadas");
                    console.log(temporadasResponse);

                    //Actualizo datos en variable content
                    //content.seasons = temporadasResponse;
                    //content.lastUpdate = date.getTime();

                    var contentUpdated = {
                        //_id: content._id,
                        id: content.id,
                        source: content.source,
                        name: content.name,
                        url: content.url,
                        seasons: temporadasResponse,
                        lastUpdate: date.getTime()
                    };

                    //Guardo en Mongo
                    Serie.update({"_id": contentUpdated.id}, contentUpdated, {}, function (err) {
                        if (err) {
                            console.log("Error actualizando la serie T en mongo: " + err);
                            callback(err);
                        } else {
                            console.log("CALLBACK");
                            callback(null, {
                                temporadas: temporadasResponse,
                                source: contentUpdated.source
                            });
                        }
                    });

                    //Actualizo el fichero
                    /*content.seasons = temporadasResponse;
                     content.lastUpdate = date.getTime();
                     fs.writeFile('jsons/series/' + idSerie + '.json', JSON.stringify(content), 'utf8');

                     console.log("CALLBACK");
                     callback(null, {
                     temporadas: temporadasResponse,
                     source: content.source
                     });*/
                });
            }

            //NewPCT1
            if (content.source === 'N' || content.source === 'SN1') {
                console.log("Página de newp1");

                //Saco el número de páginas que hay para poder procesarlas
                numpags = $('ul.pagination li').length;
                category = 'Serie';

                //Provisionalmente miro si es HD o VO, en cuyo caso sólo puedo mirar la página 1 que no funciona la paginación //TODO
                if ($url.indexOf('series-hd') > -1) {
                    numpags = 0;
                    category = 'Serie HD'
                }
                if ($url.indexOf('series-vo') > -1) {
                    numpags = 0;
                    category = 'Serie V.O.'
                }

                console.log("Num pags: " + numpags);

                //Miro si hay más páginas o no
                if (numpags == 0) {
                    //No hay más
                    paginas.push({url: $url, type: category, request: request, cheerio: cheerio});
                } else {
                    //Hay más
                    numpags = numpags - 2; //elimino los enlaces Next y Last

                    $url = newpctUtils.generateNewpctSeriePage($url, urls['N']);

                    //Construyo los enlaces
                    for (var i = 1; i <= numpags; i++) {
                        paginas.push({url: $url + i, type: category, request: request, cheerio: cheerio});
                    }
                }

                console.log("PAGINAS");
                console.log(paginas);

                console.log('    Ahora saco los capítulos');

                //Cojo la información de las páginas
                async.map(paginas, newpctUtils.extractNewcptChapters, function (err, results) {
                    if (err) {
                        console.log('Error al obtener los capitulos de newpct1: ' + err);
                    }

                    //Tengo en results un array de arrays url + cabecera
                    console.log("RESULTADOOOOOOOS");
                    console.log(results);

                    //Recorro los results extrayendo la información
                    temporadasResponse = newpctUtils.parseTorrentsNewpct(results, urls['N'], md5);

                    //Actualizo datos en variable content
                    //content.seasons = temporadasResponse;
                    //content.lastUpdate = date.getTime();

                    var contentUpdated = {
                        //_id: content._id,
                        id: content.id,
                        source: content.source,
                        name: content.name,
                        url: content.url,
                        seasons: temporadasResponse,
                        lastUpdate: date.getTime()
                    };

                    //Guardo en Mongo
                    Serie.update({"_id": contentUpdated.id}, contentUpdated, function (err) {
                        if (err) {
                            console.log("Error actualizando la serie N1 en mongo: " + err);
                            callback(err);
                        } else {
                            console.log("CALLBACK");
                            callback(null, {
                                temporadas: temporadasResponse,
                                source: contentUpdated.source
                            });
                        }
                    });

                    //Actualizo el fichero
                    /*content.seasons = temporadasResponse;
                     content.lastUpdate = date.getTime();
                     fs.writeFile('jsons/series/' + idSerie + '.json', JSON.stringify(content), 'utf8');

                     console.log("CALLBACK");
                     callback(null, {
                     temporadas: temporadasResponse,
                     source: content.source
                     });*/
                });
            }
//�
            //NewPCT
            if (content.source === 'SN') {
                console.log("Página de newp original");

                var patron = /(.*) - (Temp\.|Temporada )([0-9]+) \[([A-Za-z 0-9]+)\]\[([a-zA-Z \.0-9]+)\](.+)/;

                //Saco la lista de temporadas y capítulos del menú izquierdo
                $('div#content-temp ul li ul li a').each(function () {
                    var enlace = $(this).attr('href');
                    var title = $(this).attr('title');

                    enlace = enlace.replace(urls['SN'], '');

                    console.log('patron: ' + patron);
                    console.log('title: ' + title);

                    var trozos = patron.exec(title);

                    //Compruebo que obtengo los trozos que quería
                    if (trozos && trozos.length === 7) {
                        var mTemporada = parseInt(trozos[3]);

                        var capi = trozos[5].substr(-2); //los dos últimos dígitos son el capi

                        console.log("Trozos");
                        console.log(trozos);

                        if (temporadasResponse[mTemporada] === undefined) {
                            temporadasResponse[mTemporada] = [];
                        }

                        if (title) {
                            title = title.replace('�', 'ñ');
                        }

                        var titleSmall = trozos[1];
                        if (titleSmall) {
                            titleSmall = titleSmall.replace('�', 'ñ');
                        }

                        temporadasResponse[mTemporada].push({
                            id: md5('SN' + trozos[1] + enlace),
                            torrentId: null,
                            url: enlace,
                            title: title,
                            titleSmall: titleSmall,
                            chapter: parseInt(capi),
                            language: sanitize(trozos[6].replace('[', '').replace(']', '')),
                            format: trozos[4],
                            source: 'SN',
                            size: ''
                        });
                    }
                });
                /*
                 C.S.I. Las Vegas - Temp.9 [HDTV][Cap.901][Spanish]
                 C.S.I. Las Vegas - Temporada 8 [HDTV][Cap.817][Spanish]

                 temporadas[mTemporada].push({
                 id: md5('N' + metadata.title + $url),
                 torrentId: null,
                 url: $url,
                 title: torrent.h2.replace('Serie ', ''),
                 titleSmall: metadata.title,
                 chapter: parseInt(metadata.chapter),
                 language: metadata.language,
                 format: metadata.format,
                 source: 'N',
                 size: metadata.size
                 });
                 */

                //Actualizo datos en variable content
                //content.seasons = temporadasResponse;
                //content.lastUpdate = date.getTime();

                var contentUpdated = {
                    //_id: content._id,
                    id: content.id,
                    source: content.source,
                    name: content.name,
                    url: content.url,
                    seasons: temporadasResponse,
                    lastUpdate: date.getTime()
                };

                //Guardo en Mongo
                Serie
                    .update({"_id": contentUpdated.id}, contentUpdated, function (err) {
                        if (err) {
                            console.log("Error actualizando la serie N en mongo: " + err);
                            callback(err);
                        } else {
                            console.log("CALLBACK");
                            callback(null, {
                                temporadas: temporadasResponse,
                                source: contentUpdated.source
                            });
                        }
                    });
            }
        });
    }

    var downloadTorrent = function downloadTorrent(res, idTorrent, titleTorrent, source) {
        var $url = urlsTorrentDownload[source] + idTorrent;

        console.log("Descargo torrent: " + $url);

        http.get($url, function (resp) {
            if (resp.statusCode !== 200) {
                var response = {error: "Se produjo un error"};
                res.status(500).send(response);
                throw "Error: 500";
            } else {
                console.log(resp.headers);
                var disposition = resp.headers['content-disposition'],
                    content = resp.headers['content-type'];

                if (disposition === undefined) {
                    disposition = 'attachment; filename="' + titleTorrent + '.torrent"';
                }
                if (content === undefined) {
                    content = 'application/octet-stream';
                }
                console.log("content: " + content);
                console.log("dispo:" + disposition);
                res.set({
                    'Content-Type': content,
                    'Content-Disposition': disposition
                });

                resp.on('data', function (chunk) {
                    res.write(chunk);
                }).on('end', function () {
                    res.end();
                });
            }
        });

    };
};
/*
 localhost/api/trex/download/0a9c569f5d405a1d4a09b74c0ec00cd3/cf20871700789c7736dde60168cabd43
 http://localhost/api/trex/download/e3fbc5990153378bcea6e21ff707912b/280fee8c0e578db1836fa136eb04672f
 */

function generateTorrentsData(temporadas, source) {
    var resp = {}, $lastSeason = 0, $numSeasons = 0;

    resp.seasonsDetail = {};

    console.log("Da temps");
    console.log(temporadas);

    for (var index in temporadas) {
        if (temporadas.hasOwnProperty(index) && temporadas[index]) {
            var temp = temporadas[index];

            var $lastChapter = 0;
            temp.forEach(function (chapter) {
                var currentChap = parseInt(chapter.chapter, 10);
                if ($lastChapter < currentChap) {
                    $lastChapter = currentChap;
                }
            });

            resp.seasonsDetail[index] = {
                chapters: temp.length,
                lastChapter: $lastChapter
            };

            if ($lastSeason < index) {
                $lastSeason = index;
            }

            $numSeasons++;
        }
    }

    resp.seasons = $numSeasons;
    resp.lastSeason = $lastSeason;
    resp.source = source;
    return resp;
}


function removeExtrangeAndDuplicatedChapters(temporadas, serieName, qualitySelected) {
    //Defino lo que es para mí low y high
    var quality = {
            low: ['HDTV'],
            high: ['HDTV 720p']
        },
        finalTemporadas = {};

    //Si no he elegido calidad o no es válida, pongo low por defecto
    if (!qualitySelected || (qualitySelected !== 'low' && qualitySelected !== 'high')) {
        qualitySelected = 'low';
    }

    //console.log("Calidad: " + qualitySelected);
    for (var index in temporadas) {
        if (temporadas.hasOwnProperty(index)) {
            var temp = temporadas[index];

            var chapters = {};
            finalTemporadas[index] = [];

            //Recorro los capítulos y los organizo por format
            temp.forEach(function (chapter) {
                console.log(chapter);
                //Deduzco si es un capitulo de la serie o no para tenerlo en cuenta
                if (isPartOfSerie(serieName, chapter.titleSmall)) {
                    if (!chapters[chapter.format]) {
                        chapters[chapter.format] = [];
                    }

                    chapters[chapter.format].push(chapter);
                }
            });

            //Ahora elijo un formato u otro según la elección
            var firstIndexFormat = '';
            for (var indexFormat in chapters) {
                if (chapters.hasOwnProperty(indexFormat)) {
                    if (firstIndexFormat === '') {
                        firstIndexFormat = indexFormat;
                    }

                    //Si es de la calidad que esperaba relleno
                    if (quality[qualitySelected].indexOf(indexFormat) !== -1) {
                        finalTemporadas[index] = chapters[indexFormat];
                    }
                }
            }

            //Si no he rellenado por lo que sea
            if (finalTemporadas[index].length === 0) {
                //Relleno con el primer indice
                finalTemporadas[index] = chapters[firstIndexFormat];
            }
        }
    }

    return finalTemporadas;
}

function isPartOfSerie(serieName, chapterName) {
    console.log("LEVENS");
    console.log(serieName);
    console.log(chapterName);

    //Si no me pasan alguno de los datos, para no fallar devuelvo que true
    if (!serieName || !chapterName) {
        return true;
    }

    //Para considerarlo parte de la serie el 50% de caracteres han de coincidir
    var totalLength = serieName.length;

    //Calculo el num de caracteres que pueden ser erróneos, que es el 25%
    var charsThatCanBeWrong = Math.ceil(totalLength * 50 / 100);
    console.log("Max error: " + charsThatCanBeWrong);
    //Distancia
    var dist = new levi(serieName, chapterName);

    //Si la distancia es mayor, no considero que sea parte de la serie
    return dist.distance <= charsThatCanBeWrong;
}

function capitalize(name) {
    name = normalizeName(name);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeName(name) {
    return name.toLowerCase().replace(/-(.)/g, function (match, group1) {
        return ' ' + group1.toUpperCase();
    });
}

function sanitize(text) {
    if (!text) {
        return null;
    }

    //Dejo sólo alfanuméricos
    text = text.replace(/[^a-zA-Zñé0-9 ]/g, "");
    return text.replace('�', 'ñ');
}

function dbTrexDisconnect() {
    mongoose.disconnect();
}

process.on('exit', dbTrexDisconnect);
process.on('SIGINT', dbTrexDisconnect);
process.on('SIGTERM', dbTrexDisconnect);
