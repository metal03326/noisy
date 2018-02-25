# Release notes
All notable changes to this project will be documented in this file.
Versionning of This project adheres to [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) with omitted hyphens (YYYYMMDD).

## dev:
- Merged Play and Pause buttons into a single button
- New playlist find system

## 20180218:
- Added support for tag reading of Opus files
- Improved MP3/OGG/M4A tag reading
- Fixed and improved last.fm scrobbling
- Optimized animations
- Minimized theme sizes
- Introduced new Welcome window - What's New
- Removed Dev Channel
- Removed responsive design (to be re-implemented later)
- Removed custom tooltips - now using default browser tooltip
- Made languages and themes asynchronous
- Switched to Material design icons
- Switched to Roboto as a default font
- Added blur bellow every opened window
- Switched loading indicator
- Lots of code was re-written with only new browsers in mind
- A lot of code cleanup

## 20170506:
- Switched Dropbox to APIv2
- Removed Application Cache (offline mode - to be re-implemented later as Service Worker)
- Other small improvements

## 20141123:
- Fixed problems with navigating inside of Google Drive using mouse only
- Small improvements

## 20141119:
- Improved support for mobile devices
- Fixed Power saver to disable itself when device is charging
- Small fixes

## 20141117:
- Added Power saver support for Google Chrome
- Added tag reading support for Google Drive
- Fixed bug where Noisy always enters Power saving mode (if enabled)
- Removed slide for last.fm warning, as they have added support for HTTPS

## 20141115:
- Fixed menu when One tab option is enabled
- Fixed battery indicator to show actual battery level on hover
- Fixed multiselect with Shift key

## 20141111:
- New background music to the video
- Minified video
- Playing of the intro video now doesn't require the user to click on the second play button
- Added 50% mark to the progress bar
- Made all request to last.fm to go through https. They don't support it, but if they start, that will fix problems with it. For now they redirect to http instead
- Added slide to the News explaining problems with last.fm

## 20141110:
- More SEO optimizations
- New video
- Fixed volume and progress bars problem when dragging beyond the beginning or end
- Fixed playback stop after item end because the user clicked pause while preloading the next item
- Fixed bug with playback meters not being updated (but audio plays) when playback mode is set to Repeat (track)

## 20140623:
- SEO optimizations

## 20140621:
- Performance improvement: All files are combined in one to minimize requests (and waiting) to the server
- Performance improvement: All code is minified to reduce size of Noisy
- Dev channel introduced
- Small fixes

## 20140618:
- Fixed Remove from playlist keyboard shortcut not working
- Fixed last item in cloud file explorer not being fully visible to the user
- User gets redirected to connect to the cloud service he clicked on when trying to add files/folders from cloud he had not previously connected to
- Fixed closing cloud file explorer while loading items results in loading overlay stays forever
- Fixed Open button in cloud file explorer not enabling when folder is selected
- Fixed local file playback

## 20140617:
- Added Follow us section in About
- Added this changelog (CHANGES.txt)
- Few code optimizations

## 20140615:
- Initial release