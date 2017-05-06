var fs = require( 'fs' ),
	minifier = require( 'html-minifier' ),
	CleanCSS = require( 'clean-css' ),
	UglifyJS = require( "uglify-js" ),
	isDev = false,
	isProd = false,
	foldersToClean,
	data,
	i,
	splitted,
	parts,
	index = '',
	len,
	css,
	file,
	name,
	minified = '',
	compressor,
	toplevel,
	compressed_ast,
	newVersion = new Date().toISOString().split( 'T' )[ 0 ].replace( /-/g, '' ),
	filesToCopyInDev = [ 'index.html', 'CHANGES.txt', 'browserconfig.xml', 'video.html', 'video.mp3', 'video.ogg', 'open_graph.png' ],
	filesToCopyInProduction = [
		'browserconfig.xml', 'CHANGES.txt', 'sitemap.xml', 'robots.txt',
		'google9638db4c20f16281.html', 'video.mp3', 'video.ogg', 'open_graph.png'
	];

function emptyFolder( path )
{
	console.log( 'Cleaning ', path );
	var files = fs.readdirSync( path ),
		stats;
	files.forEach( function( file )
	{
		stats = fs.statSync( path + file );
		if( stats.isFile() )
		{
			fs.unlinkSync( path + file );
		}
	} );
}

switch( process.argv.pop() )
{
	case 'dev':
		isDev = true;
		foldersToClean = [ './dev/', './noisy-player/deploy/dev/' ];
		break;
	case 'prod':
		isProd = true;
		foldersToClean = [ './noisy-player/deploy/' ];
		break;
	default:
		isDev = true;
		isProd = true;
		foldersToClean = [ './dev/', './noisy-player/deploy/', './noisy-player/deploy/dev/' ];
}

for( i = 0; i < foldersToClean.length; i++ )
{
	emptyFolder( foldersToClean[ i ] );
}

console.log( 'Updating player.js to version', newVersion );
data = fs.readFileSync( './player.js', 'utf8' );
splitted = data.split( 'version:' );
parts = splitted[ 1 ].split( ',' );
parts[ 0 ] = ' ' + newVersion;
splitted[ 1 ] = parts.join( ',' );
data = splitted.join( 'version:' );
fs.writeFileSync( './player.js', data );

console.log( 'Updating CHANGES.txt to version', newVersion );
data = fs.readFileSync( './CHANGES.txt', 'utf8' );
splitted = data.split( ':' );
splitted[ 0 ] = newVersion;
data = splitted.join( ':' );
fs.writeFileSync( './CHANGES.txt', data );

data = minifier.minify( fs.readFileSync( './index.html', 'utf8' ), {
	removeComments: true,
	removeCommentsFromCDATA: true,
	removeCDATASectionsFromCDATA: true,
	collapseWhitespace: true,
	collapseBooleanAttributes: true,
	removeAttributeQuotes: true,
	removeRedundantAttributes: true,
	useShortDoctype: true,
	removeEmptyAttributes: true,
	removeOptionalTags: true,
	minifyJS: true,
	minifyCSS: true
} );

// Find all the CSS files and replace them by their contents
splitted = data.split( '<link ' );
len = splitted.length;
for( i = 0; i < len; i++ )
{
	parts = splitted[ i ].split( '>' );
	css = parts[ 0 ].split( '.css' );
	if( css.length > 1 )
	{
		name = css[ 0 ].split( 'href=' )[ 1 ] + '.css';
		filesToCopyInDev.push( name );
		if( isProd )
		{
			console.log( 'Merging', name, 'into index.html' );
			file = fs.readFileSync( './' + name, 'utf8' );
			minified = new CleanCSS().minify( file );
		}
		index = index.substr( 0, index.length - 6 );
		index += '<style type="text/css">\n' + minified.styles + '\n\t\t</style>\n\t\t<link ';
	}
	else
	{
		index += parts.join( '>' ) + '<link ';
	}
}

// Remove last <link
index = index.substr( 0, index.length - 6 );

// Get all the JS files and replace them with their contents
splitted = index.split( '<script ' );
index = '';
len = splitted.length;
for( i = 0; i < len; i++ )
{
	parts = splitted[ i ].split( '>' );
	css = parts[ 0 ].split( '.js' );
	if( css.length > 1 )
	{
		name = css[ 0 ].split( 'src=' )[ 1 ] + '.js';
		filesToCopyInDev.push( name );
		if( isProd )
		{
			console.log( 'Merging', name, 'into index.html' );
			file = fs.readFileSync( './' + name, 'utf8' );
			compressor = UglifyJS.Compressor();
			toplevel = UglifyJS.parse( file );
			toplevel.figure_out_scope();
			compressed_ast = toplevel.transform( compressor );
			minified = compressed_ast.print_to_string();
		}
		index = index.substr( 0, index.length - 8 );
		index += '<script type="text/javascript">\n' + minified + '\n';
		parts.shift();
	}
	index += parts.join( '>' ) + '<script ';
}

// Remove last <script
index = index.substr( 0, index.length - 8 );

if( isProd )
{
	index = index.replace( /<\/script><script type="text\/javascript">/g, '' ).replace( /\n\n/g, '' ).replace( /"use strict"/g, '' ) + '</body></html>';
	console.log( 'Saving index.html to deploy' );
	fs.writeFileSync( './noisy-player/deploy/index.html', index );

	data = fs.readFileSync( './video.html', 'utf8' );
	data = minifier.minify( data, {
		removeComments: true,
		removeCommentsFromCDATA: true,
		removeCDATASectionsFromCDATA: true,
		collapseWhitespace: true,
		collapseBooleanAttributes: true,
		removeAttributeQuotes: true,
		removeRedundantAttributes: true,
		useShortDoctype: true,
		removeEmptyAttributes: true,
		removeOptionalTags: true,
		minifyJS: true,
		minifyCSS: true
	} );
	console.log( 'Saving video.html to deploy' );
	fs.writeFileSync( './noisy-player/deploy/video.html', data );
}

// Copy all non processed files to the dev folder
if( isDev )
{
	len = filesToCopyInDev.length;
	for( i = len; i--; )
	{
		name = filesToCopyInDev[ i ];
		console.log( 'Copying', name, 'to dev folders' );
		fs.createReadStream( './' + name ).pipe( fs.createWriteStream( './noisy-player/deploy/dev/' + name ) );
		fs.createReadStream( './' + name ).pipe( fs.createWriteStream( './dev/' + name ) );
	}
}

if( isProd )
{
	len = filesToCopyInProduction.length;
	for( i = len; i--; )
	{
		name = filesToCopyInProduction[ i ];
		console.log( 'Copying', name, 'to deploy folder' );
		fs.createReadStream( './' + name ).pipe( fs.createWriteStream( './noisy-player/deploy/' + name ) );
	}
}