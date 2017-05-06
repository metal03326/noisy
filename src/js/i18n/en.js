var lang_en =
{
	 title: "Noisy - Your cloud player"
	,menu:
	{
		"playback-order-default": "Default"
		,"playback-order-repeat-playlist": "Repeat (playlist)"
		,"playback-order-repeat-track": "Repeat (track)"
		,"playback-order-random": "Random"
		,"playback-order-stop-after-current": "Stop after current"
		,"add-playlist-hint-text": "Click to add new playlist"
		,"search-playlist-hint-text": "Click to search in the active playlist"
		,"main-menu-hint-text": "Click main menu to connect to the cloud (<span data-icon='<'></span>), add files from it (<span data-icon='='></span>), save/load playlists (<span data-icon='9'></span>/<span data-icon='8'></span>) and many more"
	}
	,window:
	{
		"preferences-window-title": "Preferences"
		,"about-window-title": "About Noisy"
		,"find-window-title": "Find"
		,"connect-window-title": "Connect to..."
		,"add-window-title": "Add files from cloud"
		,"save-playlist-window-title": "Save playlist as..."
		,"load-playlist-window-title": "Load playlist..."
		,"save-preferences-window-title": "Save Preferences as..."
		,"load-preferences-window-title": "Load Preferences..."
		,"welcome-window-title": "Welcome to Noisy"
		,"local-window-title": "Add files from your local drive"
		,"youtube-search-window-title": "YouTube results for:"
		,"preference-general-legend": "Playback state display formatting:"
		,"preference-general-playlist": "Playlist:"
		,"preference-general-title": "Window title:"
		,"preference-general-statusbar": "Status bar:"
		,"preference-general-notification": "Notification popup:"
		,"preference-general-cursor-playback": "Cursor follows playback"
		,"preference-general-playback-cursor": "Playback follows cursor"
		,"preference-general-hide-tabs": "Hide playlist tabs when only one playlist"
		,"preference-keyboard-shortcut": "Shortcut"
		,"preference-keyboard-action": "Action"
		,"preference-performance-powersaver": "Power saver"
		,"preference-performance-powersaver-threshold": "Threshold: "
		,"preference-performance-animation": "Enable animations"
		,"preference-performance-scrobbling": "Enable Last.fm scrobbling"
		,"preference-performance-scrobbling-position": "Scrobblе after:"
		,"preference-performance-scrobbling-queued-tracks": "Tracks to scrobble:"
		,"preference-performance-counter": "Enable progress time display"
		,"preference-performance-notifications": "Show notification when changing items"
		,"preference-performance-notes": "<b>Note:</b> All of these options when enabled will get better user experience in expense of CPU power. Turn off to make Noisy more responsive, needing less resources."
		,"currently-connected-to": "Currently connected to:"
		,"make-connection-to": "Connect to "
		,"show-on-startup": "Show on startup"
		,"console-title-text": "Console"
		,"moto": "Your cloud player"
		,"faq-title": "FAQ"
		,"confirmation": "Are you sure?"
		,"button-reset-preferences": "Reset to defaults"
		,"button-export-preferences": "Export Preferences"
		,"button-import-preferences": "Import Preferences"
		,"themes-label": "Theme:"
		,"languages-label": "Language:"
		,"translation-contributors-label": "Translators:"
		,"by": "by"
		,"choose-files-to-play": "Please choose files to play:"
		,"file-upload-method-or": "or"
		,"drop-zone": "Drop files here"
		,"file-upload-method-note": "Note:"
		,"playback-limitations": "Due to limitations in web technologies, files from local computer cannot be remembered inside any playlist. All files chosen now won't be saved with the playlist they are in."
		,"local-text": "Local"
		,"selected-playback-files-trigger": "Choose file(s)"
		,"about-follow-us": "Follow us on:"
		,"about-used-resources": "Used resources:"
		,"about-font-icons": "Font icons downloaded from"
		,"about-icons": "Icons images downloaded from"
		,"fav-icons": "Favicons generated using"
		,"md5-library": "MD5 library by"
		,"about-music": "Music by"
	}
	,faq:
	{
		q:
		[
			 "What do I need to use Noisy?"
			,"Which cloud services are supported?"
			,"Do you collect my data?"
			,"Can I play local files?"
			,"Can I play video files?"
			,"Can Noisy work offline?"
			,"Why Noisy doesn't support my language?"
			,"What is the 5MB quota?"
		]
		,a:
		[
			{
				adv: [
					{
						 "span": "To use Noisy you'll need a minimum resolution of 800x480 pixels and a browser from the following list (or newer):"
						,"ul":
						{
							adv: [
								{
									"li": "Google Chrome 29"
								}
								,{
									"li": "Mozilla Firefox 25"
								}
								,{
									"li": "Internet Explorer 11"
								}
								,{
									"li": "Safari 6.1"
								}
								,{
									"li": "Opera 15"
								}
								,{
									"li": "Mobile Firefox 25"
								}
							]
						}
					}
					,{
						 "span": "Not supported:"
						,"ul":
						{
							adv: [
								{
									"li": "iOS Safari"
								}
								,{
									"li": "Android browser"
								}
								,{
									"li": "Mobile Chrome"
								}
							]
						}
					}
					,{
						 "span": "Notes on support:"
						,"ul":
						{
							adv: [
								{
									"li": "iOS is not supported due to Apple's restriction on audio playback (only human can start playback, which means you can play only song by song, by yourself)."
								}
								,{
									"li": "Noisy is fixated on performance, so each new browser feature that is introduced and it makes things faster, will be implemented. This will probably limit browser compatibility to only the latest version of your browser."
								}
							]
						}
					}
				]
			}
			,{
				"span": "For now only <a href='//dropbox.com/' target='_blank'>Dropbox</a> and <a href='//drive.google.com/' target='_blank'>Google Drive</a>, but other services are planned, too. We also offer audio scrobbling to <a href='http://last.fm/' target='_blank'>last.fm</a>."
			}
			,{
				"span": "No. Noisy is client side only application, meaning we don't have any server logic. That said, we cannot store any of your information with us, even if we want to. All your information is saved in your browser, not in our server. That's the reason for your playlists and settings not to sync between browsers - we don't have any information about you to send to the other browse."
			}
			,{
				"span": "Yes, local files can be played by Noisy. Note, though, that due to security limitations, Noisy cannot save the path to your local files, meaning it won't be able to play them after restart. That's why we won't save local files to the playlist."
			}
			,{
				"span": "For now only audio files are supported, but video playback is in the plan, too."
			}
			,{
				"span": "Yes, Noisy works offline, too, but only with local files. We support HTML5 offline mode which allows us to make Noisy available to you even if you don't have active internet connection, but we cannot make your audio tracks available, since they are in the cloud storage service. So long story short - you can run Noisy offline to play local files."
			}
			,{
				"span": "Official support is only for English and Bulgarian. All other languages are done by the users. If your language is not from those and you want to help with the translation, you can write us at metal" + "03326@" + "noisy" + "player.com"
			}
			,{
				"span": "Web technologies have limitations to prevent bad people doing bad things on user's PC. Such limitation is the quota for how much data you can store on user's device. By limiting each site to 5MB the user is assured that his hard drive won't be overflowed with information from any particular site. Noisy uses this quota to save your playlists and preferences so next time you come to have them instantly loaded. Typically, in 5MB Noisy should be able to save playlists with a total items count of around 13000-14000 before running out of space. Noisy warns the user both when quota gets above 4MB and when it reaches the limit."
			}
		]
	}
	,welcome:
	[
		'<div id="slideshow-video-placeholder" data-iframe="<iframe width=\'690\' height=\'380\' src=\'video.html\' frameborder=\'0\' allowfullscreen></iframe>" onclick="n.playSlideshowVideo(this)"><span id="slideshow-video-play" data-icon="x"></span></div>'
		,'<div class="float-left"><div data-icon="b" style="font-size: 250px; color: rgb(42, 95, 42);margin-top:50px;"></div></div><div><span class="slide-text"><b style="font-size: 46px;padding: 20px 0;display: inline-block;">Noisy goes beta!</b><br />After more than an year of development, Noisy is ready to face the world! Try it now - <b>no account creation needed!</b></span></div>'
		,'<h1 style="text-align: center">5 best features of Noisy?</h1><span class="slide-text"><ol class="best-features-list"><li><span data-icon="Y"></span> Free</li><li><span data-icon="I"></span> Lightweight</li><li><span data-icon="g"></span> Available everywhere</li><li><span data-icon="u"></span> Available offline</li><li><span data-icon="r"></span> No collection of your personal information</li></ol></span>'
		,'<div class="float-right"><img id="welcome-window-logo" /></div><div style="text-align: right;padding: 0 220px 0 0;"><h1>Why you should use Noisy?</h1><span class="slide-text">Simple. Because you can do it right away, without any account creation, any licence agreements or any 300 clicks to get started. Just connect Noisy to your favorite cloud service and you are ready to go!</span></div>'
		,'<div class="float-left"><div data-icon="$" style="font-size: 250px; color: rgb(95, 0, 8); margin: 50px 5px 0 5px;"></div></div><div><span class="slide-smaller-text"><div style="font-size: 20px;padding-top: 20px;">Introducing</div><div style="font-size: 36px;font-weight: bold;">DEV CHANNEL</div><p>Dev channel is a special place for all you people, who love to be on the edge and want to try the latest and greatest features of Noisy!</p><p>Here at Dev channel, you\'ll get upcoming features and bug fixes before others do.</p><p>Be aware, though. Noisy running in Dev channel is a bit unstable, as less testing is done. But it\'s worth it! And you can leave any time you want.</p><p>To join, go to Preferences and click Join Dev channel button. Hope you like it!</p></span></div>'
	]
	,placeholders:
	{
		"find-item": "Enter name to search"
		,"save-playlist-window-filename": "Enter filename"
	}
	,preferences:
	{
		 "general": "General"
		,"appearance": "Appearance"
		,"keyboard": "Keyboard shortcuts"
		,"performance": "Performance"
	}
	,actions:
	{
		 "play": "Play"
		,"pause": "Pause"
		,"stop": "Stop"
		,"playPause": "Play/Pause"
		,"next": "Next"
		,"nextRandom": "Next random"
		,"prev": "Previous"
		,"showSearch": "Find"
		,"addToQueue": "Add to queue"
		,"removeFromQueue": "Remove from queue"
		,"volumeUp": "Volume up"
		,"volumeDown": "Volume down"
		,"toggleMute": "Toggle mute"
		,"removeFromPlaylist": "Remove from playlist"
	}
	,themes:
	{
		 "blue": "Blue"
		,"default": "Default"
		,"forum": "Forum"
		,"grey": "Grey"
		,"green": "Green"
		,"contrast": "High contrast"
		,"orange": "Orange"
		,"pink": "Pink"
		,"purple": "Purple"
		,"red": "Red"
	}
	,buttons:
	{
		 "button-ok": "Ok"
		,"button-cancel": "Cancel"
		,"button-close": "Close"
		,"button-connect": "Connect"
		,"button-add": "Add"
		,"button-open": "Open"
		,"button-load": "Load"
		,"button-save": "Save"
		,"button-yes": "Yes"
		,"button-no": "No"
		,"button-submit": "Submit"
		,"button-clear": "Clear"
	}
	,validation:
	{
		 "exists-text": "Already exists"
		,"invalid-text": "Invalid data supplied"
	}
	,console:
	{
		 "ms": "ms"
		,"startup": "Startup time: "
		,"playbackStart": "Opening file for playback: "
		,"playbackWait": "Waiting file for playback: "
		,"auth": "Authenticating with "
		,"connected": "Connected to "
		,"as": "as "
		,"no": "No"
		,"error-loading-playlist": "Error loading playlist "
		,"missing-element": "Missing element (probably old settings): "
		,"cannot-load-url": "Cannot load URL: "
		,"saved": "Saved "
		,"failed-to-save": "Failed to save "
		,"quota-used": "Quota used: "
		,"quota-limit-nearing": "5 MB localStorage limit nearing. Quota used: "
		,"quota-limit-reached": "5 MB localStorage limit reached! Delete some playlists to free up space for the normal operation of Noisy"
		,"connection-retry": "Problems connecting to the cloud. Retry: "
		,"error-getting-access-token": "Problems while trying to get access token for "
		,"update": "Update for Noisy downloaded. Refresh needed to load it"
		,"manifest-error": "Download failed, or newer version uploaded while the download was in progress"
		,"manifest-downloading": "Downloading update..."
		,"manifest-noupdate": "Noisy is up to date"
		,"manifest-checking": "Checking for updates..."
		,"manifest-cached": "Noisy downloaded"
	}
	,footer:
	{
		 "footer-finished": "Adding files finished. Added items: "
		,"adding-files-from": "Adding files from "
		,"added-items": " Added items: "
		,"error-see-console": "Error. See <a href='javascript:;'>console</a> for more info"
		,"operation-successful": "Operation successful"
		,"please-wait": "Please wait..."
	}
	,other:
	{
		"new-playlist": "New Playlist"
		,"notification-title": "Noisy is playing"
		,"not-supported": " (not supported on this browser)"
		,"dropbox-playlist-convert": "Convert local playlist? "
		,"click-here": "Click here"
		,"button-channel-switcher": "Join Dev channel"
		,"button-channel-switcher-dev": "Leave Dev channel"
		,"not-connected": "Not connected. Click to connect"
	}
	,help:
	{
		 "preference-general-help": "Playback state display formatting\nFormats item tags as user specified. Available strings:\n%artist% for Artist\n%title% for Title\n%album% for Album\n%date% for Date\n\nCursor follows playback\nThis will always select the item being played\n\nPlayback follows cursor\nNext item to play will be the selected item\n\nHide playlist tabs when only one playlist\nThis is going to hide tabs when only one tab is available. Useful to save space if\nuser always uses only one playlist"
		,"preference-language-help": "Do you want to help with translation?\nContact me at\nmetal" + "03326@" + "noisy" + "player.com"
		,"preference-powersaver-help": "Makes Noisy to preserve resources when device not charging and the battery level is bellow\nthe set threshold.\n\nChanges when Noisy is running in Power Saver mode:\n- No animations\n- No progress display\n- No notifications\n- No scrobbling\n- Played item will be immediately removed from cache\n- Tags won't be read"
		,"preference-dev-channel-help": "Latest, but unstable"
		,"connect": "Connect to clould"
		,"showAddFileFolder": "Add files or folders"
		,"showSavePlaylist": "Save playlist"
		,"showLoadPlaylist": "Load playlist"
		,"showAbout": "About"
		,"showWelcome": "Welcome screen"
	}
	,splash:
	{
		"initializing-noisy": "Initializing Noisy...",
		"splash-screen-text": 'If you are seeing this message for too long, this probably means the settings of Noisy are corrupted. If you are in Dev channel, try <a href="javascript:(function(){try{var settings=JSON.parse(localStorage.getItem(\'preferences\'));settings.devChannel=false;localStorage.setItem(\'preferences\',JSON.stringify(settings))}catch(e){};location.replace(\'//\'+location.host+\'/\')})()" style="text-decoration:none;color:red;">leaving it</a>. If not you can <a href="javascript:localStorage.removeItem(\'preferences\'),location.reload()" style="text-decoration:none;color:red;">click here to delete the settings</a>. If that doesn\'t help, try <a href="javascript:localStorage.removeItem(\'playlists\'),location.reload()" style="text-decoration:none;color:red;">deleting the playlists</a>, too.'
	}
};