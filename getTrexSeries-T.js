'use strict';

var DEBUG = false,
    $OPENSHIFT_REPO_DIR = '/var/lib/openshift/54c7ea625973caf628000150/app-root/runtime/repo/';

var request = require('request'),
    cheerio = require('cheerio'),
    async = require('async'),
    md5 = require('md5'),
    events = require('events'),
    fs = require('fs');

var urls = {
        txibitsoft: 'http://www.txibitsoft.com/categorias.php',
        newpctPagSD: 'http://www.newpct1.com/index.php?page=categorias&url=series/&letter=&pg=',
        newpctPagHD: 'http://www.newpct1.com/index.php?page=categorias&url=series-hd/&letter=&pg=',
        newpctPagVO: 'http://www.newpct1.com/index.php?page=categorias&url=series-vo/&letter=&pg=',
        newpctTorrentsSD: 'series/',
        newpctTorrentsHD: 'series-hd/',
        newpctTorrentsVO: 'series-vo/'
    },
    series_txibitsoft = {sd: [], hd: [], vo: []},
    series_txibitsoft_short = {sd: [], hd: [], vo: []};

//Gestor de eventos
var eventEmitter = new events.EventEmitter();

console.log('Comienzo proceso');

/*************** LISTENER DE EVENTOS ********************/

//Extraigo las series de txibitsoft
eventEmitter.on('getSeriesTxbitsoft', function () {
    console.log('Extraigo series de txbit');
    request(urls.txibitsoft, function (err, resp, body) {
        if (err) {
            throw err;
        }

        var $ = cheerio.load(body);

        //Cojo las listas
        var innerElements, innerElementsShort = [];
        $('dl').each(function () {
            innerElements = [];
            innerElementsShort = [];

            //Busco la categoría
            var cat = $(this).find('dt a').text(), $category = '';
            if (cat.indexOf('Series') > -1) {
                if (cat.indexOf('HD') > -1) {
                    $category = 'hd';
                } else if (cat.indexOf('V.O') > -1) {
                    $category = 'vo';
                } else {
                    $category = 'sd';
                }
            }

            //Cojo las series de esta categoría
            $(this).find('li a').each(function () {
                //escapo la URL
                var urlRaw = $(this).attr('href');
                var urlEncoded = encodeURI(urlRaw);

                //Lo paso a base64
                //urlEncoded = new Buffer(urlEncoded).toString('base64');
                var $id = md5('T' + $category + urlRaw);

                innerElements.push({
                    id: $id,
                    name: $(this).text(),
                    url: urlEncoded,
                    source: 'T'
                });
                innerElementsShort.push({
                    id: $id,
                    name: $(this).text()
                });
            });

            //Si la categoría es de series, lo guardo en mi objeto            
            if ($category !== '') {
                console.log('Encontré series ' + $category + ': ' + innerElements.length);

                switch ($category) {
                    case 'hd':
                        //series_txibitsoft.hd.push({title: 'Series HD', elements: innerElements});
                        series_txibitsoft.hd = innerElements.concat(series_txibitsoft.hd);
                        series_txibitsoft_short.hd = innerElementsShort.concat(series_txibitsoft_short.hd);
                        console.log('Serie HD');
                        break;

                    case 'vo':
                        //series_txibitsoft.vo.push({title: 'Series V.O.', elements: innerElements});
                        series_txibitsoft.vo = innerElements.concat(series_txibitsoft.vo);
                        series_txibitsoft_short.vo = innerElementsShort.concat(series_txibitsoft_short.vo);
                        console.log('Serie VO');
                        break;

                    case 'sd':
                        //series_txibitsoft.sd.push({title: 'Series', elements: innerElements});
                        series_txibitsoft.sd = innerElements.concat(series_txibitsoft.sd);
                        series_txibitsoft_short.sd = innerElementsShort.concat(series_txibitsoft_short.sd);
                        console.log('Serie');
                        break;
                }
            }
        });

        eventEmitter.emit('saveJSONSeries', series_txibitsoft, series_txibitsoft_short);
    });
});

//Guardo un fichero de series
eventEmitter.on('saveJSONSeries', function (data, data_short) {
    var baseUrl = '';

    if (!DEBUG) {
        baseUrl = $OPENSHIFT_REPO_DIR;
    }

    console.log('Guardo fichero json de txibitsoft');
    fs.writeFileSync(baseUrl + 'jsons/series-t.json', JSON.stringify(data_short), 'utf8');

    //Guardo ficheros por cada serie si no existen ya
    data['sd'].forEach(function (element) {
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
    data['hd'].forEach(function (element) {
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
    data['vo'].forEach(function (element) {
        if (fs.existsSync(baseUrl + 'jsons/series/' + element.id + '.json') === false) {
            fs.writeFileSync(baseUrl + 'jsons/series/' + element.id + '.json', JSON.stringify(element), 'utf8');
        }
    });
});


/*************** MAIN ******************/

//Obtengo las series de Txbit y luego las de newpct
eventEmitter.emit('getSeriesTxbitsoft');