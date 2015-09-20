'use strict';

var txibitUtils = require('../utils/txibit.js');
var newpctUtils = require('../utils/newpct.js');

module.exports = function (app) {
    var request = require('request'),
        cheerio = require('cheerio'),
        http = require('http'),
        md5 = require('md5'),
        async = require('async'),
        fs = require('fs'),
        events = require('events');

    var urls = {
        'T': 'http://www.txibitsoft.com/',
        'N': 'http://www.newpct1.com/'
    }, urlsTorrentDownload = {
        'T': 'http://www.txibitsoft.com/bajatorrent.php?id=',
        //'N': 'http://tumejorjuego.com/download/index.php?link=descargar-torrent/'
        'N': 'http://www.newpct1.com/descargar-torrent/'
    };

    var eventEmitter = new events.EventEmitter();

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
        var txbitFile = fs.readFileSync('jsons/series-t.json', 'utf-8'),
            newpctFile = fs.readFileSync('jsons/series-n.json', 'utf-8');

        var response = {
            servers: [],
            error: ""
        };

        response.servers.push(JSON.parse(txbitFile));
        response.servers.push(JSON.parse(newpctFile));

        eventEmitter.emit('sendResponse', res, response);
    };

    //GET - Recoge y devuelve todos los torrents de esta serie identificada por su ID (md5 de la url)
    var getSerieById = function (req, res) {
        var idSerie = req.params.idSerie, response = {};

        updateSerie(idSerie, function (error, tempData) {
            console.log("TERMINO UPDATE");
            if (error !== null || tempData === null) {
                response = {torrents: null, error: "Se produjo un error"};
                res.send(response);
                throw "Error: 500";
            }

            response = {
                torrents: tempData.temporadas,
                metadata: generateTorrentsData(tempData.temporadas, tempData.source),
                error: ""
            };

            console.log("La respuesta");
            console.log(response);

            //Respuesta
            eventEmitter.emit('sendResponse', res, response);
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
    app.get('/api/trex/series/:idSerie', getSerieById);             //Lista de temporadas y capítulos de una serie
    app.get('/api/trex/download/:idSerie/:id', getSeriesTorrent);   //Descarga de series de T y N

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
        var temporadasResponse = null, $url = '',
            date = new Date(), currentTime = date.getTime(), jsonTime,
            file = fs.readFileSync('jsons/series/' + idSerie + '.json', 'utf-8');

        var content = JSON.parse(file);

        //Si el lastUpdate no han pasado 24 horas no actualizo y devuelvo el contenido del json este
        if (content.lastUpdate !== undefined) {
            jsonTime = parseInt(content.lastUpdate, 10);
        } else {
            jsonTime = 0;
        }
        console.log(content);

        //Si está actualizado y ya tengo los datos devuelvo lo del json
        if (content.seasons !== undefined && Object.keys(content.seasons).length && (currentTime < (jsonTime + 24 * 60 * 60 * 1000))) {
            callback(null, {
                temporadas: content.seasons,
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

                    //Actualizo el fichero
                    content.seasons = temporadasResponse;
                    content.lastUpdate = date.getTime();
                    fs.writeFile('jsons/series/' + idSerie + '.json', JSON.stringify(content), 'utf8');

                    console.log("CALLBACK");
                    callback(null, {
                        temporadas: temporadasResponse,
                        source: content.source
                    });
                });
            }

            //NewPCT
            if (content.source === 'N') {
                console.log("Página de newp");

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
                //console.log(paginas);

                console.log('    Ahora saco los capítulos');

                //Cojo la información de las páginas
                async.map(paginas, newpctUtils.extractNewcptChapters, function (err, results) {
                    if (err) {
                        console.log('Error al obtener los capitulos de newpct: ' + err);
                    }

                    //Tengo en results un array de arrays url + cabecera
                    console.log("RESULTADOOOOOOOS");
                    console.log(results);

                    //Recorro los results extrayendo la información
                    temporadasResponse = newpctUtils.parseTorrentsNewpct(results, urls['N'], md5);

                    //Actualizo el fichero
                    content.seasons = temporadasResponse;
                    content.lastUpdate = date.getTime();
                    fs.writeFile('jsons/series/' + idSerie + '.json', JSON.stringify(content), 'utf8');

                    console.log("CALLBACK");
                    callback(null, {
                        temporadas: temporadasResponse,
                        source: content.source
                    });
                });
            }
        });
    };

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

    for (var index in temporadas) {
        if (temporadas.hasOwnProperty(index)) {
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


process.on('uncaughtException', function (err) {
    // handle the error safely
    console.log("ERROR - " + err);
});