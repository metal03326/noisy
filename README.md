# Noisy

Cloud based music player. Can play both files uploaded on [Dropbox](http://www.dropbox.com/)/[Google Drive](http://drive.google.com/) or **local files**.

Current version: **20180101**

Features:
* Lightweight
* No account needed
* No data collection, tracking and ads
* Multiple playlists
* Multiple themes
* Multiple languages
* [last.fm](http://last.fm/) scrobbling
* Keyboard shortcuts
* Import/Export of both playlists and preferences
* Power Saver function

File support is based on your browser and OS. Noisy supports reading tags for the following formats:
* MP3 (ID3v2.3-2.4)
* OGG
* M4A
* OPUS

## Getting Started

Go ahead and try it - https://www.noisyplayer.com/

### Prerequisites

None. Really. Not even an account - just connect your [Dropbox](http://www.dropbox.com/)/[Google Drive](http://drive.google.com/) or load **local files** and start listening to your own songs.

### Running locally

If you want to run the project locally, you'll need `yarn`. After you have that setup and running, you just do

```
yarn start
```

**Note**: You may need to run as super user, because project runs on port 80.

```
sudo yarn start
```

## Deployment

To run the builder:

```
yarn build
```

This should empty the `/docs` folder and fill it with the built code from the sources.

## Built With

* [IcoMoon](https://icomoon.io/) - Used for all the icons in the app.
* [DAILY OVERVIEW](http://www.dailyoverview.com) - Used for the logo.
* [RealFaviconGenerator](http://realfavicongenerator.net/) - Used to generate all the different favicons required by the browsers/devices.
* [MD5](http://pajhome.org.uk/crypt/md5/) - MD5 library used for hashing requirement of [last.fm](http://last.fm/).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

For versioning we use [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) with ommited hyphens (YYYYMMDD).

## Changelog

All changes can be seen in [CHANGES.md](CHANGES.md).

## Authors

* **Tsvetelin Novkirishki** - *Initial work* - [metal03326](https://github.com/metal03326)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details

## Acknowledgments

* [foobar2000](http://www.foobar2000.org/) - UI inspiration.
* [Brian Langenberger](https://sourceforge.net/projects/audiotools/) - Audio Formats Reference