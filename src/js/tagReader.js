self.onmessage = function ( event )
{
	let { buffer, extension } = event.data;

	let dv            = new DataView( buffer );
	let toGet;
	let byte;
	let metadata      = {};
	let isMatchingTag = function ( tag, byte )
	{
		// Check for match in the first char
		if ( dv.getUint8( byte ) === tag.charCodeAt( 0 ) )
		{
			let match = true;

			// loop through all letters to make sure we have found a match
			for ( let k = 1; k < tag.length; k++ )
			{
				if ( dv.getUint8( byte + k ) !== tag.charCodeAt( k ) )
				{
					match = false;
					break;
				}
			}

			return match;
		}

		return false;
	};

	// Choose algorithm
	switch ( extension )
	{
		case 'mp3':
			// Check if file has ID3v2 tag - we support only those
			if ( dv.getInt8( 0 ) === 73 && dv.getInt8( 1 ) === 68 && dv.getInt8( 2 ) === 51 )
			{
				let version           = dv.getInt8( 3 );
				// We need only these tags for now
				toGet                 = {
					'TPE1': 'artist', //'TPE2'
					'TIT2': 'title',
					'TALB': 'album',
					'TYER': 'date'
				};
				let len               = Object.keys( toGet ).length;
				let byte              = 4;
				const compressionFlag = version === 4 ? 8 : 128;
				const encryptionFlag  = version === 4 ? 4 : 64;
				const mask            = compressionFlag | encryptionFlag;

				// 4 bytes, starting from byte 7, shows the length of the tag (ID3v2, containing all tags)
				while ( byte < dv.getInt32( 6 ) && len )
				{
					let tagFound = false;

					Object.keys( toGet ).forEach( tag =>
					{
						if ( isMatchingTag( tag, byte ) )
						{
							tagFound = true;

							// We have read the tag past it
							byte += 4;

							// 10 byte header by specification:
							// 4 bytes of frame id (byte - 4, byte - 3, byte - 2 and byte - 1)
							// 4 bytes of frame size (byte, byte + 1, byte + 2 and byte + 3)
							// 2 bytes of flags (byte + 4 and byte + 5)

							let tagLength = dv.getUint32( byte );

							const secondFlagsByte = dv.getInt8( byte + 5 );

							// After reading the length of the tag move the cursor even past the flags
							byte += 6;

							// We do not support both compression and encryption
							if ( secondFlagsByte & mask )
							{
								// Skip this tag
								byte += tagLength;

								delete toGet[ tag ];
								len = Object.keys( toGet ).length;

								return;
							}

							let tagValue = '';

							// First byte shows if the tag is encoded in Unicode or not
							let matchCharCode = dv.getUint8( byte++ );

							// If UTF-16: 1 is with BOM, 2 is without BOM
							if ( matchCharCode === 1 || matchCharCode === 2 )
							{
								let bomModifier = 0;

								// BE support
								if ( dv.getUint8( byte ) < dv.getUint8( byte + 1 ) || matchCharCode === 2 )
								{
									bomModifier = 1;
								}

								// First 3 bytes are used for encoding and BOM if we matched 01. For 02 we only have
								// encoding character. This results in: matchCharCode === 1 we have to deduct 3,
								// otherwise we deduct only 1
								tagLength -= 1 + 2 * Math.abs( matchCharCode - 2 );

								// Move past BOM, if BOM
								if ( matchCharCode === 1 )
								{
									byte += 2;
								}

								let k = byte + tagLength;

								for ( byte; byte < k; byte += 2 )
								{
									let matchCharCode = dv.getUint8( byte + bomModifier );
									let nextMatch     = dv.getUint8( byte + 1 + bomModifier * -1 );

									// Skip adding of 00
									matchCharCode && (tagValue += `%${matchCharCode.toString( 16 ).padStart( 2, '0' )}`);
									nextMatch && (tagValue += `%${nextMatch.toString( 16 ).padStart( 2, '0' )}`);
								}
							}
							// UTF-8 (matchCharCode === 3) and ISO-8859-1 (matchCharCode === 0)
							else
							{
								// First byte is encoding
								tagLength -= 1;

								let k = byte + tagLength;

								for ( byte; byte < k; byte++ )
								{
									tagValue += `%${dv.getUint8( byte ).toString( 16 ).padStart( 2, '0' )}`;
								}
							}

							metadata[ toGet[ tag ] ] = decodeURIComponent( tagValue );

							// Subtract last step increase, as next tag comes right after this one
							byte--;
							delete toGet[ tag ];
							len = Object.keys( toGet ).length;
						}
					} );

					// If we haven't found the tag, we still need to move the cursor to the next byte
					if ( !tagFound )
					{
						byte++;
					}
				}
			}
			break;
		// Ogg container is used for Opus codec and some .ogg files can be Ogg Opus instead of Ogg Vorbis
		case 'opus':
		case 'ogg':
			// We need only these tags for now
			toGet = [
				'artist',
				'title',
				'album',
				'date'
			];
			byte  = 0;

			// Search for comments. They are after header, which is at around 100 byte
			while ( byte < 1000 )
			{
				let firstChar = dv.getInt8( byte );
				// [03][vorbis] ||
				// [OpusTags]
				if (
					firstChar === 3 && dv.getInt8( byte + 1 ) === 118 && dv.getInt8( byte + 2 ) === 111 && dv.getInt8( byte + 3 ) === 114 && dv.getInt8( byte + 4 ) === 98 && dv.getInt8( byte + 5 ) === 105 && dv.getInt8( byte + 6 ) === 115 ||
					firstChar === 79 && dv.getInt8( byte + 1 ) === 112 && dv.getInt8( byte + 2 ) === 117 && dv.getInt8( byte + 3 ) === 115 && dv.getInt8( byte + 4 ) === 84 && dv.getInt8( byte + 5 ) === 97 && dv.getInt8( byte + 6 ) === 103 && dv.getInt8( byte + 7 ) === 115
				)
				{
					// If we are Ogg Vorbis, move past [03][vorbis]
					if ( firstChar === 3 )
					{
						byte += 7;
					}
					// Otherwise move past [OpusTags]
					else
					{
						byte += 8;
					}
					break;
				}
				byte++;
			}

			// If we have found tags
			if ( byte < 999 )
			{
				// Skip vendor string (4 bytes for the length and the length itself)
				byte += 4 + dv.getInt32( byte, true );

				let numberOfComments = dv.getInt32( byte, true );

				let i = 0;

				// Move past number of comments
				byte += 4;

				while ( i < numberOfComments && toGet.length )
				{
					i++;
					let tagLength = dv.getInt32( byte, true );

					// Move past comment length
					byte += 4;

					let tagFound = false;

					for ( let l = 0; l < toGet.length; l++ )
					{
						let tag = toGet[ l ];

						if ( isMatchingTag( tag, byte ) || isMatchingTag( tag.toUpperCase(), byte ) )
						{
							tagFound = true;

							// Move past [tag][=]
							byte += tag.length + 1;

							tagLength -= tag.length + 1;

							let end = byte + tagLength;

							let tagValue = '';

							for ( byte; byte < end; byte++ )
							{
								tagValue += `%${dv.getUint8( byte ).toString( 16 ).padStart( 2, '0' )}`;
							}

							metadata[ tag ] = decodeURIComponent( tagValue );

							toGet.splice( toGet.indexOf( tag ), 1 );
							break;
						}
					}

					// If we haven't found the tag, we still need to move the cursor to the next comment
					if ( !tagFound )
					{
						byte += tagLength;
					}
				}
			}

			break;
		case 'm4a':
			toGet   = {
				'©art': 'artist',
				'©nam': 'title',
				'©alb': 'album',
				'©day': 'date'
			};
			let len = Object.keys( toGet ).length;
			byte    = 0;

			let fileSize = dv.byteLength;

			// Loop the whole file, as m4a doesn't have specifications where to place ilst container atom
			while ( byte < fileSize && len )
			{
				let tagFound = false;

				for ( let tag in toGet )
				{
					if ( toGet.hasOwnProperty( tag ) && isMatchingTag( tag, byte ) || isMatchingTag( tag.toUpperCase(), byte ) )
					{
						tagFound = true;

						// Tag is read
						byte += 4;

						// Pattern: @tag [xx xx xx xx] [data] [yy yy yy yy] [00 00 00 00] [actual data] [00 00 00]
						// Where: @tag tag name, xx size data, yy type data, 00 padding

						// Get the length and subtract [data], [yy yy yy yy], [00 00 00 00] and [00 00 00]
						let tagLength = dv.getUint32( byte ) - 15;

						// Length is read, move after [00 00 00 00]
						byte += 16;

						let tagValue = '';

						let k = byte + tagLength;

						for ( byte; byte < k; byte++ )
						{
							let charCode = dv.getUint8( byte );

							// Skip adding of 00
							charCode && (tagValue += `%${charCode.toString( 16 ).padStart( 2, '0' )}`);
						}

						metadata[ toGet[ tag ] ] = decodeURIComponent( tagValue );
						delete toGet[ tag ];
						len = Object.keys( toGet ).length;
					}
				}

				// If we haven't found the tag, we still need to move the cursor to the next byte
				if ( !tagFound )
				{
					byte++;
				}
			}
			break;
	}

	self.postMessage( metadata );

	close();
};