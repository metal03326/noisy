/**
 * Noisy communication module for Google Drive
 *
 * @author metal03326
 * @version 20170506
 */

// Google Drive singleton to be passed to Noisy
var googledrive = new Cloud({
    name: 'Google Drive',

    urls: {
        connect: "https://accounts.google.com/o/oauth2/auth?response_type=token&client_id=" +
        encodeURIComponent("700131777259.apps.googleusercontent.com") +
        "&scope=" +
        encodeURIComponent('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/youtube') + //https://www.googleapis.com/auth/plus.login
        "&redirect_uri=" +
        encodeURIComponent(location.protocol + '//' + location.host + location.pathname),
        info: {url: 'https://www.googleapis.com/drive/v2/about'},
        query: {url: "https://www.googleapis.com/drive/v2/files?q='{{path}}' in parents and not trashed"},
        folder: "https://www.googleapis.com/drive/v2/files/{{path}}",
        play: {url: 'https://www.googleapis.com/drive/v2/files/{{path}}'},
        savePlaylist: {url: 'https://www.googleapis.com/upload/drive/v2/files?uploadType=media'},
        savePlaylist2: 'https://www.googleapis.com/drive/v2/files/{{path}}'
    },

    responseKeys: {
        display_name: 'name',
        contents: 'items',
        item: 'title',
        folder: 'mimeType',
        id: 'id'
    },

    rootPath: 'root',

    usesIds: true,

    youTubeSearch: function (q) {
        var container = document.getElementById('youtube-search-window-content');
        container.innerHTML = '';
        this.ajaxRequest('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=' + encodeURIComponent(q), function (xhr) {
            document.getElementById('youtube-search-window-title').innerHTML = n.lang.window['youtube-search-window-title'] + ' ' + q;
            var response = JSON.parse(arguments[0].response),
                row,
                item;

            for (var i = 0; i < response.items.length; i++) {
                item = response.items[i];
                row = document.createElement('div');
                row.className = 'youtube-item cf';
                row.innerHTML = '<span class="youtube-item-image-wrapper" data-id="'.concat( item.id.videoId, '"><img src="', item.snippet.thumbnails.default.url, '" alt="', item.snippet.title, '"/></span><span class="youtube-item-name">', item.snippet.title, '</span><br /><span class="youtube-item-by"><span class="by"></span> ', item.snippet.channelTitle, '</span><br /><span class="youtube-item-description">', item.snippet.description, '</span><br /><a href="https://www.youtube.com/watch?v=', item.id.videoId, '" class="youtube-item-url">https://www.youtube.com/watch?v=', item.id.videoId, '</a><span class="youtube-share-container"><button onclick="n.shareYouTubeLink(this)" class="youtube-item-share-icon"><i data-icon="F"></i></button><button onclick="n.shareYouTubeLink(this)" class="youtube-item-share-icon"><i data-icon="G"></i></button></span>')
                container.appendChild(row);
                row.children[0].addEventListener('click', function () {
                    this.classList.add( 'youtube-embeded' );
                    this.innerHTML = '<iframe width="120" height="90" src="//www.youtube.com/embed/' + this.dataset.id + '?autoplay=1" frameborder="0" allowfullscreen></iframe>'
                });
            }
        }, function () {
        }, 'GET', '', {});
    }
});

var res = {
    "kind": "youtube#searchListResponse",
    "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/Mb2mV2s4BD1QERygOtDSEM6dHFc\"",
    "nextPageToken": "CAUQAA",
    "pageInfo": {
        "totalResults": 981519,
        "resultsPerPage": 5
    },
    "items": [
        {
            "kind": "youtube#searchResult",
            "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/NTWQEJH8lPwslwrP3Y0GfW0YpAM\"",
            "id": {
                "kind": "youtube#video",
                "videoId": "WM8bTdBs-cw"
            },
            "snippet": {
                "publishedAt": "2009-10-27T01:53:30.000Z",
                "channelId": "UCbulh9WdLtEXiooRcYK7SWw",
                "title": "Metallica - One [Official Music Video]",
                "description": "One [Official Music Video] From the album \"...And Justice For All\" Director: Bill Pope and Michael Salomon Filmed in December 1988 in Long Beach, CA Video ...",
                "thumbnails": {
                    "default": {
                        "url": "https://i.ytimg.com/vi/WM8bTdBs-cw/default.jpg"
                    },
                    "medium": {
                        "url": "https://i.ytimg.com/vi/WM8bTdBs-cw/mqdefault.jpg"
                    },
                    "high": {
                        "url": "https://i.ytimg.com/vi/WM8bTdBs-cw/hqdefault.jpg"
                    }
                },
                "channelTitle": "MetallicaTV",
                "liveBroadcastContent": "none"
            }
        },
        {
            "kind": "youtube#searchResult",
            "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/tqt-BVf1JroMR6NeDzuwh1uz5sU\"",
            "id": {
                "kind": "youtube#video",
                "videoId": "aSNJ00iAZ7I"
            },
            "snippet": {
                "publishedAt": "2008-04-22T14:24:21.000Z",
                "channelId": "UCCqApm7f_zbNNqNAlMt5Ckw",
                "title": "Metallica - One (Full Lyrics)",
                "description": "INBOX ME FOR ADVERTISEMENTS http://free-music-toolbar.info.",
                "thumbnails": {
                    "default": {
                        "url": "https://i.ytimg.com/vi/aSNJ00iAZ7I/default.jpg"
                    },
                    "medium": {
                        "url": "https://i.ytimg.com/vi/aSNJ00iAZ7I/mqdefault.jpg"
                    },
                    "high": {
                        "url": "https://i.ytimg.com/vi/aSNJ00iAZ7I/hqdefault.jpg"
                    }
                },
                "channelTitle": "Guitarkid1034",
                "liveBroadcastContent": "none"
            }
        },
        {
            "kind": "youtube#searchResult",
            "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/kTzjPUqf5EoouaWXfB0GKgRtY3k\"",
            "id": {
                "kind": "youtube#video",
                "videoId": "sXPkmIwwobA"
            },
            "snippet": {
                "publishedAt": "2009-03-02T19:42:11.000Z",
                "channelId": "UCqajpssEoWUEEKjihGZEr1g",
                "title": "Metallica - One (Studio Version)",
                "description": "Metallica - One (Studio Version)",
                "thumbnails": {
                    "default": {
                        "url": "https://i.ytimg.com/vi/sXPkmIwwobA/default.jpg"
                    },
                    "medium": {
                        "url": "https://i.ytimg.com/vi/sXPkmIwwobA/mqdefault.jpg"
                    },
                    "high": {
                        "url": "https://i.ytimg.com/vi/sXPkmIwwobA/hqdefault.jpg"
                    }
                },
                "channelTitle": "SinkoProductions",
                "liveBroadcastContent": "none"
            }
        },
        {
            "kind": "youtube#searchResult",
            "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/u3Sqjjl2SdzXNAz2AK-5NcnbXSU\"",
            "id": {
                "kind": "youtube#video",
                "videoId": "Favl3kzWejA"
            },
            "snippet": {
                "publishedAt": "2010-05-17T20:29:48.000Z",
                "channelId": "UCPpEOGs7t1MK9gg38_NXzog",
                "title": "Metallica - One  1080p HD",
                "description": "METALLICA HD ONE PLEASE RATE AND COMENT.",
                "thumbnails": {
                    "default": {
                        "url": "https://i.ytimg.com/vi/Favl3kzWejA/default.jpg"
                    },
                    "medium": {
                        "url": "https://i.ytimg.com/vi/Favl3kzWejA/mqdefault.jpg"
                    },
                    "high": {
                        "url": "https://i.ytimg.com/vi/Favl3kzWejA/hqdefault.jpg"
                    }
                },
                "channelTitle": "shenko3dom",
                "liveBroadcastContent": "none"
            }
        },
        {
            "kind": "youtube#searchResult",
            "etag": "\"F9iA7pnxqNgrkOutjQAa9F2k8HY/yLmA0cv3mhW6IO8ZMQ_8vam6nIk\"",
            "id": {
                "kind": "youtube#video",
                "videoId": "4odVTSdSY88"
            },
            "snippet": {
                "publishedAt": "2014-06-29T01:05:24.000Z",
                "channelId": "UCCj956IF62FbT7Gouszaj9w",
                "title": "Metallica - One at Glastonbury 2014",
                "description": "Guidance: Contains flashing images. Metallica perform at Glastonbury 2014. For more exclusive videos and photos from across Glastonbury 2014, go to the ...",
                "thumbnails": {
                    "default": {
                        "url": "https://i.ytimg.com/vi/4odVTSdSY88/default.jpg"
                    },
                    "medium": {
                        "url": "https://i.ytimg.com/vi/4odVTSdSY88/mqdefault.jpg"
                    },
                    "high": {
                        "url": "https://i.ytimg.com/vi/4odVTSdSY88/hqdefault.jpg"
                    }
                },
                "channelTitle": "BBC",
                "liveBroadcastContent": "none"
            }
        }
    ]
};