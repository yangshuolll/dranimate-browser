var canvas = document.getElementById('myCanvas');
var context = canvas.getContext('2d');

var mouse = {};

var image;

var slic;
var slicSegmentsCentroids;

var highlightData;
var highlightImage = new Image();

var imageNoBackgroundData;
var imageNoBackgroundImage = new Image();

var contourData;
var contourImage = new Image();

var contourPoints;

var vertices;
var triangles;

var imageLoader = document.getElementById('imageLoader');
imageLoader.addEventListener('change', function(e){
        var reader = new FileReader();
        reader.onload = function(event){
                image = new Image();
                image.onload = function(){
                        doSLICOnImage();
                }
                image.src = event.target.result;
        }
        reader.readAsDataURL(e.target.files[0]);     
}, false);


var dummyCanvas = document.createElement("canvas");
dummyCanvas.width = 578;
dummyCanvas.height = 400;
var dummyContext = dummyCanvas.getContext("2d");

function redraw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1.0;
    context.drawImage(image, 0, 0, image.width, image.height,
                            0, 0, canvas.width, canvas.height);
    context.drawImage(highlightImage, 
                                            0, 0, highlightImage.width, highlightImage.height,
                                            0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.8;
    context.drawImage(imageNoBackgroundImage, 
                                            0, 0, imageNoBackgroundImage.width, imageNoBackgroundImage.height,
                                            0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1.0;
    context.drawImage(contourImage, 
                                            0, 0, contourImage.width, contourImage.height,
                                            0, 0, canvas.width, canvas.height);

    if(slicSegmentsCentroids) {
        for(var i = 0; i < slicSegmentsCentroids.length; i++) {
            var segment = slicSegmentsCentroids[i];
            if(segment) {
                var centroidX = slicSegmentsCentroids[i][0];
                var centroidY = slicSegmentsCentroids[i][1];

                context.beginPath();
                context.arc(centroidX, centroidY, 3, 0, 2 * Math.PI, false);
                context.fillStyle = 'yellow';
                context.fill();
            }
        }
    }
    if(contourPoints) {
        for(var i = 0; i < contourPoints.length; i++) {
            var centroidX = contourPoints[i][0];
            var centroidY = contourPoints[i][1];

            context.beginPath();
            context.arc(centroidX, centroidY, 3, 0, 2 * Math.PI, false);
            context.fillStyle = '#00FF00';
            context.fill();
        }
    }

    if(triangles) {
        for(var i = 0; i < triangles.length; ) {
            context.beginPath();
            context.moveTo(vertices[triangles[i]][0], vertices[triangles[i]][1]); i++;
            context.lineTo(vertices[triangles[i]][0], vertices[triangles[i]][1]); i++;
            context.lineTo(vertices[triangles[i]][0], vertices[triangles[i]][1]); i++;
            context.closePath();
            context.stroke();
        }
    }
}

function doSLICOnImage() {

    dummyContext.drawImage(image, 0, 0, image.width, image.height,
                                  0, 0, dummyCanvas.width, dummyCanvas.height);
    var imageData = dummyContext.getImageData(0, 0,
                                              dummyCanvas.width,
                                              dummyCanvas.height);

    slic = new SLIC(imageData, { method: "slic", regionSize: 40 });
    imageNoBackgroundData = context.createImageData(slic.result.width, slic.result.height);

    redraw();
}

function getEncodedSLICLabel(array, offset) {
    return array[offset] |
          (array[offset + 1] << 8) |
          (array[offset + 2] << 16);
}

function recalculateContourPoints() {

    var contourPointsRaw = [];
    
    /* Convert contour image into list of points */

    for (var x = 0; x < contourData.width; ++x) {
        for (var y = 0; y < contourData.height; ++y) {
            if(getColorAtXY(x,y,"a",contourData) == 255) {
                contourPointsRaw.push([x,y]);
            }
        }
    }

    /* Resample list of points */

    contourPoints = [];

    var resampleDist = 20;
    for(var i = 0; i < contourPointsRaw.length; i++) {
        var a = contourPointsRaw[i];
        for(var j = 0; j < contourPointsRaw.length; j++) {
            if(i != j) {
                var b = contourPointsRaw[j];
                var ax = a[0];
                var ay = a[1];
                var bx = b[0];
                var by = b[1];
                var dx = Math.abs(bx - ax);
                var dy = Math.abs(by - ay);
                if(Math.sqrt(dx*dx+dy*dy) < resampleDist) {
                    contourPointsRaw.splice(j, 1);
                    j--;
                }
            }
        }
    }
    contourPoints = contourPointsRaw;

    redraw();

}

function recalculateCentroids() {

    slicSegmentsCentroids = [];

    for(var i = 0; i < slic.result.numSegments; i++) {
        findCentroidOfSLICSegment(slic.result,i);
    }

}

function findCentroidOfSLICSegment(slicImageData, SLICLabel) {

    /* Find all pixels that have the label we're looking for */

    var pixelPoints = []

    for (var x = 0; x < slicImageData.width; ++x) {
        for (var y = 0; y < slicImageData.height; ++y) {
            var index = getIndexOfXY(x,y,slicImageData);
            var currentSLICLabel = getEncodedSLICLabel(slicImageData.data, index);
            if(currentSLICLabel == SLICLabel) {
                pixelPoints.push([x,y]);
            }
        }
    }

    /* Calculate centroid (average points) */

    var totalX = 0;
    var totalY = 0;
    for(var i = 0; i < pixelPoints.length; i++) {
        totalX += pixelPoints[i][0];
        totalY += pixelPoints[i][1];
    }
    var avgX = totalX / pixelPoints.length;
    var avgY = totalY / pixelPoints.length;

    var centroid = [avgX,avgY];

    /* Update slicSegmentsCentroids if the centroid is not part of the background */

    var roundedCentroid = [Math.round(centroid[0]), Math.round(centroid[1])];
    if(getColorAtXY(roundedCentroid[0], roundedCentroid[1], "a", imageNoBackgroundData) == 255) {
        slicSegmentsCentroids[SLICLabel] = centroid;
    }

}

function findEdgesOfImage() {

    var width = imageNoBackgroundData.width;
    var height = imageNoBackgroundData.height;
    var data = imageNoBackgroundData.data;

    /* Generate contour image */

    contourData = context.createImageData(slic.result.width, slic.result.height);

    for (var i = 0; i < height; ++i) {
      for (var j = 0; j < width; ++j) {
        var offset = 4 * (i * width + j);
        var alpha = data[4 * (i * width + j) + 3];
        var isSLICBoundary = (alpha !== data[4 * (i * width + j - 1)] ||
                              alpha !== data[4 * (i * width + j + 1)] ||
                              alpha !== data[4 * ((i - 1) * width + j)] ||
                              alpha !== data[4 * ((i + 1) * width + j)]);
        var isOnImageBorder = i === 0 ||
                              j === 0 ||
                              i === (height - 1) ||
                              j === (width - 1);
        var isBoundary = isSLICBoundary && !isOnImageBorder;

        var p = 4 * (i * width + j);
        if (isBoundary) {
          contourData.data[p] = 255;
          contourData.data[p+1] = 0;
          contourData.data[p+2] = 0;
          contourData.data[p+3] = 255;
        } else {
          contourData.data[p] = 255;
          contourData.data[p+1] = 0;
          contourData.data[p+2] = 0;
          contourData.data[p+3] = 0;
        }
      }
    }

    /* Resample contour image */

    /*
    for (var x = 0; x < contourData.width; ++x) {
        for (var y = 0; y < contourData.height; ++y) {
            if(getColorAtXY(x,y,"a",contourData) == 255) {

                setColorAtXY(x+1,y,"a",contourData,0);
                setColorAtXY(x,y+1,"a",contourData,0);
                setColorAtXY(x-1,y,"a",contourData,0);
                setColorAtXY(x,y-1,"a",contourData,0);

                setColorAtXY(x+1,x+1,"a",contourData,0);
                setColorAtXY(x+1,y-1,"a",contourData,0);
                setColorAtXY(x-1,y-1,"a",contourData,0);
                setColorAtXY(x-1,y+1,"a",contourData,0);
            }
        }
    }
    */

    dummyContext.putImageData(contourData, 0, 0);
    contourImage.src = dummyCanvas.toDataURL("image/png");
    contourImage.onload = function() {
        redraw();
    }

}

function addSelectionToNoBackgroundImage() {

    for (var i = 0; i < slic.result.data.length; i += 4) {
        if(highlightData.data[i+3] == 255) {
            imageNoBackgroundData.data[i]     = 255;
            imageNoBackgroundData.data[i + 1] = 255;
            imageNoBackgroundData.data[i + 2] = 255;
            imageNoBackgroundData.data[i + 3] = 255;
        }
    }

    dummyContext.putImageData(imageNoBackgroundData, 0, 0);
    imageNoBackgroundImage.src = dummyCanvas.toDataURL("image/png");
    imageNoBackgroundImage.onload = function() {
        redraw();
    }
}

function removeSelectionToNoBackgroundImage() {

    for (var i = 0; i < slic.result.data.length; i += 4) {
        if(highlightData.data[i+3] == 255) {
            imageNoBackgroundData.data[i]     = 0;
            imageNoBackgroundData.data[i + 1] = 0;
            imageNoBackgroundData.data[i + 2] = 0;
            imageNoBackgroundData.data[i + 3] = 0;
        }
    }

    dummyContext.putImageData(imageNoBackgroundData, 0, 0);
    imageNoBackgroundImage.src = dummyCanvas.toDataURL("image/png");
    imageNoBackgroundImage.onload = function() {
        redraw();
    }
}

function updateHighligtedSuperpixel() {
    if(slic) {
        var selectedLabel = [];
        var selectedIndex = 4*(mouse.y*slic.result.width+mouse.x);
        selectedLabel.push(slic.result.data[selectedIndex]);
        selectedLabel.push(slic.result.data[selectedIndex+1]);
        selectedLabel.push(slic.result.data[selectedIndex+2]);

        highlightData = context.createImageData(slic.result.width, slic.result.height);

        for (var i = 0; i < slic.result.data.length; i += 4) {
            if(selectedLabel[0] === slic.result.data[i] &&
               selectedLabel[1] === slic.result.data[i+1] &&
               selectedLabel[2] === slic.result.data[i+2]) {
                highlightData.data[i]     = 255;
                highlightData.data[i + 1] = 0;
                highlightData.data[i + 2] = 0;
                highlightData.data[i + 3] = 255;
            } else {
                highlightData.data[i]     = 255;
                highlightData.data[i + 1] = 0;
                highlightData.data[i + 2] = 0;
                highlightData.data[i + 3] = 0;
            }
        }

        dummyContext.putImageData(highlightData, 0, 0);
        highlightImage.src = dummyCanvas.toDataURL("image/png");
        highlightImage.onload = function() {
            redraw();
        }
    }
}

function generateMesh() {

    /* Create list of vertices from superpixel centroids and contour points */

    vertices = [];

    for(var i = 0; i < contourPoints.length; i++) {
        vertices.push(contourPoints[i]);
    }
    for(var i = 0; i < slicSegmentsCentroids.length; i++) {
        var segment = slicSegmentsCentroids[i];
        if(segment) {
            vertices.push(slicSegmentsCentroids[i]);
        }
    }

    /* Run delaunay on vertices to generate mesh */

    var rawTriangles = Delaunay.triangulate(vertices);

    /* Remove trianges whose centroids are in the image background */

    triangles = [];

    for(var i = 0; i < rawTriangles.length; i+=3) {
        var x1 = vertices[rawTriangles[i]][0];
        var y1 = vertices[rawTriangles[i]][1];

        var x2 = vertices[rawTriangles[i+1]][0];
        var y2 = vertices[rawTriangles[i+1]][1];

        var x3 = vertices[rawTriangles[i+2]][0];
        var y3 = vertices[rawTriangles[i+2]][1];

        var centroidX = Math.round((x1 + x2 + x3) / 3);
        var centroidY = Math.round((y1 + y2 + y3) / 3);

        if(getColorAtXY(centroidX,centroidY,"a",imageNoBackgroundData) == 255) {
            triangles.push(rawTriangles[i]);
            triangles.push(rawTriangles[i+1]);
            triangles.push(rawTriangles[i+2]);
        }
    }

    var vertsString = "";
    for(var i = 0; i < vertices.length; i++) {
        vertsString += vertices[i][0];
        vertsString += ",";
        vertsString += vertices[i][1];
        vertsString += ",";
    }
    console.log(vertsString);

    var trisString = "";
    for(var i = 0; i < triangles.length; i++) {
        trisString += triangles[i];
        trisString += ",";
    }
    console.log(trisString);

}

canvas.addEventListener('mousemove', function(evt) {
    evt.preventDefault(); 

    var rect = canvas.getBoundingClientRect();
    mouse.x = evt.clientX - rect.left;
    mouse.y = evt.clientY - rect.top;

    updateHighligtedSuperpixel();

    if(mouse.leftClickDown) {
        addSelectionToNoBackgroundImage();
    }
    if(mouse.rightClickDown) {
        removeSelectionToNoBackgroundImage();
    }
}, false);

canvas.addEventListener('mousedown', function(evt) {
    evt.preventDefault(); 
    if(evt.which == 3) {
        removeSelectionToNoBackgroundImage();
        mouse.rightClickDown = true;
    } else {
        addSelectionToNoBackgroundImage();
        mouse.leftClickDown = true;
    }
});

canvas.addEventListener('contextmenu', function(evt) {
    evt.preventDefault();
    mouse.rightClickDown = true;
    return false;
}, false);

canvas.addEventListener('mouseup', function(evt) {
    evt.preventDefault(); 
    if(evt.which == 3) {
        mouse.rightClickDown = false;
    } else {
        mouse.leftClickDown = false;
    }
});

document.getElementById("calcContoursButton").onclick = function() {     
    recalculateCentroids(); 
    findEdgesOfImage();
    recalculateContourPoints();
};

document.getElementById("genMeshButton").onclick = function() {     
    generateMesh();
    redraw();
};