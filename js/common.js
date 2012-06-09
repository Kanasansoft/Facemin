var video;
var display;
var work;

var displayContext;
var workContext;

var videoWidth;
var videoHeight;
var workWidth;
var workHeight;
var displayWidth;
var displayHeight;

var displayScale = 1;
var workScale = 0.125;

var audioContext   = new webkitAudioContext();
var sampleRate     = audioContext.sampleRate;
var	bufferSize     = 4096;
var javaScriptnode = audioContext.createJavaScriptNode(bufferSize, 0, 2);

var frequency = 440;
var volume    = 0;

var lastAudioValue    = 0;
var preLastAudioValue = 0;

function attachUserMedia(videoElement) {
	if ("getUserMedia" in navigator) {
		navigator.getUserMedia(
			{audio : true, video : true, toString : function(){return "video, audio";}},
			function(stream) {
				videoElement.src = stream;
			},
			function(e) {
				console.log(err);
			}
		);
	} else if ("webkitGetUserMedia" in navigator) {
		navigator.webkitGetUserMedia(
			{audio : true, video : true, toString : function(){return "video, audio";}},
			function(stream) {
				var url = webkitURL.createObjectURL(stream);
				videoElement.src = url;
			},
			function(e) {
				console.log(err);
			}
		);
	} else {
		console.log("nothing : user stream");
	}
}

function getAudioValue(position) {
	return Math.sin(2 * Math.PI * frequency * (position / sampleRate));
}

function onAudioProcess(e) {

	var outputL = e.outputBuffer.getChannelData(0);
	var outputR = e.outputBuffer.getChannelData(1);
	var bufferData = new Float32Array(bufferSize);

	var position = 0;

	while(position < 100000){
		position++;
		var fastAudioValue     = getAudioValue(position + 0);
		var postFastAudioValue = getAudioValue(position + 1);
		if((preLastAudioValue - lastAudioValue) * (fastAudioValue - postFastAudioValue) > 0 && (preLastAudioValue + lastAudioValue) * (fastAudioValue + postFastAudioValue) > 0){
			if(preLastAudioValue - lastAudioValue > 0 && lastAudioValue - fastAudioValue > 0){
				break;
			}
			if(preLastAudioValue - lastAudioValue < 0 && lastAudioValue - fastAudioValue < 0){
				break;
			}
		}
		if(preLastAudioValue * lastAudioValue < 0 && fastAudioValue * postFastAudioValue < 0){
			break;
		}
	}

	for (var i = 0; i < bufferSize; i++) {
		bufferData[i] = getAudioValue(position) * volume;
		position++;
	}

	preLastAudioValue = getAudioValue(position - 2);
	lastAudioValue    = getAudioValue(position - 1);
	outputL.set(bufferData);
	outputR.set(bufferData);

}

function repeat() {

	workContext.drawImage(
		video,
		0, 0, videoWidth, videoHeight,
		0, 0, workWidth, workHeight
	);

	var imageData = workContext.getImageData(0, 0, workWidth, workHeight);

	var grayscale = ccv.grayscale(work);

	var result = ccv_for_realtime.detect_objects(
		{
			"canvas"        : grayscale,
			"cascade"       : cascade,
			"interval"      : 5,
			"min_neighbors" : 1
		}
	);

	displayContext.drawImage(
		video,
		0, 0, videoWidth, videoHeight,
		0, 0, displayWidth, displayHeight
	);

	if (result.length == 1) {

		var x = result[0].x;
		var y = result[0].y;
		var width = result[0].width;
		var height = result[0].height;

		var ratioX = 1 - x / (workWidth  - width);
		var ratioY = 1 - y / (workHeight - height);

		frequency = Math.pow(
			2,
			(
				Math.min(x, y) / Math.min(width, height) / 0.25 +
				ratioX / 0.125
			) / 12
		) * 440 / 2;
		volume    = Math.min(1, volume * 0.9 + ratioY * 0.1);

		var rectX      = result[0].x / workWidth * displayWidth;
		var rectY      = result[0].y / workHeight * displayHeight;
		var rectWidth  = result[0].width / workWidth * displayWidth;
		var rectHeight = result[0].height / workHeight * displayHeight;

		displayContext.strokeStyle = "#cccccc";
		displayContext.strokeRect(
			rectX,
			rectY,
			rectWidth,
			rectHeight
		);

		displayContext.strokeStyle = "#333333";
		displayContext.strokeRect(
			rectX + 1,
			rectY + 1,
			rectWidth - 2,
			rectHeight -2
		);

	} else {
		ccv.grayscale(display);
		volume *= 0.9;
	}

	setTimeout(repeat, 0);

}

function initialize() {

	work             = document.createElement("canvas");
	workContext      = work.getContext("2d");

	video            = document.getElementById("video");
	display          = document.getElementById("display");
	displayContext   = display.getContext("2d");

	video.addEventListener(
		"playing",
		function(e){
			var style       = window.getComputedStyle(video, null);
			videoWidth      = parseInt(style.width,  10);
			videoHeight     = parseInt(style.height, 10);
			displayWidth    = videoWidth * displayScale;
			displayHeight   = videoHeight * displayScale;
			workWidth       = videoWidth * workScale;
			workHeight      = videoHeight * workScale;
			display.width   = displayWidth;
			display.height  = displayHeight;
			work.width      = workWidth;
			work.height     = workHeight;
			display.style.width   = Math.round(displayWidth).toString(10) + "px";
			display.style.height  = Math.round(displayHeight).toString(10) + "px";
			repeat();
		},
		false
	);

	attachUserMedia(video);

	// audioprocessイベントは、何故かaddEventListenerで設定できない
	javaScriptnode.onaudioprocess = onAudioProcess;
	javaScriptnode.connect(audioContext.destination);

}

window.addEventListener("load", initialize, false);
