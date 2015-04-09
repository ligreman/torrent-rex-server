module.exports = function (app) {
    var request = require('request'),
        cheerio = require('cheerio');

    //GET - Obtiene las categorías (series, etc)
    getCategories = function (req, res) {
        var url = 'http://www.txibitsoft.com/categorias.php', response = {};

        request(url, function (err, resp, body) {
            if (err) {
                response = {
                    categories: null,
                    error: "Se produjo un error"
                };

                res.send(response);
                throw err;
            }

            $ = cheerio.load(body);

            //Cojo las listas
            var innerElements, innerCategories = [];
            $('dl').each(function () {
                innerElements = [];

                $(this).find('li a').each(function () {
                    //escapo la URL
                    var urlEncoded = encodeURI($(this).attr('href'));

                    //Lo paso a base64
                    urlEncoded = new Buffer(urlEncoded).toString('base64');

                    innerElements.push({name: $(this).text(), url: urlEncoded});
                });

                innerCategories.push({title: $(this).find('dt a').text(), elements: innerElements});
            });

            response = {
                categories: innerCategories,
                error: ""
            };

            //Respuesta
            res.set({
                'Content-Type': 'application/json; charset=utf-8'
            }).json(response);
        });
    };

    //GET - Obtiene los torrent de una categoría
    getTorrents = function (req, res) {
        var url = req.params.categoryUrl;
        url = new Buffer(url, 'base64').toString('ascii');  //utf8
        url = 'http://www.txibitsoft.com/' + url;

        request(url, function (err, resp, body) {
            if (err) {
                response = {
                    torrents: null,
                    error: "Se produjo un error"
                };

                res.send(response);
                throw err;
            }

            $ = cheerio.load(body);

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

            response = {
                torrents: innerTorrents,
                error: ""
            };

            //Respuesta
            res.set({
                'Content-Type': 'application/json; charset=utf-8'
            }).json(response);
        });
    };


    //GET - Obtiene los torrent de una búsqueda
    getSearch = function (req, res) {
        var url = req.params.term;
        url = new Buffer(url, 'base64').toString('ascii');  //utf8
        url = 'http://www.txibitsoft.com/torrents.php?procesar=1&texto=' + encodeURI(url) + '&categorias=%27Cine%20Alta%20Definicion%20HD%27,%27Peliculas%27,%27Peliculas%20Castellano%27';

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

            $ = cheerio.load(body);

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
            res.set({
                'Content-Type': 'application/json; charset=utf-8'
            }).json(response);
        });
    };

    //Descargo un torrent y lo envío al plugin
    downloadTorrent = function (req, res) {
        var id = req.params.id;
        request(
            {
                url: 'http://www.txibitsoft.com/bajatorrent.php?id=' + id,
                encoding: 'binary',
                timeout: 10000
            },
            function (err, resp, body) {
                if (resp.statusCode !== 200) {
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end(err.message);
                } else {
                    var disposition = resp.request.response.headers['content-disposition'];
                    var torrent = new Buffer(body, 'binary');

                    //Respuesta
                    res.set({
                        'Content-Type': 'application/octet-stream; charset=utf-8',
                        'Content-Disposition': disposition
                    });

                    res.write(torrent);
                    res.end();
                }
            });
    };

    //Las rutas
    app.get('/api/tx/download/:id', downloadTorrent);
    app.get('/api/tx/categories', getCategories);
    app.get('/api/tx/torrents/:categoryUrl', getTorrents);
    app.get('/api/tx/search/:term/:pageSearch', getSearch);
};