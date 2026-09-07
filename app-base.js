/* ============================================================
   Mathe mit AndyBrandy - Basis-JS (static)
   ============================================================ */
(function(){
  "use strict";

  /* ============ Utilities ============ */
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function randf(min,max){ return Math.random()*(max-min)+min; }
  function choice(arr){ return arr[rand(0,arr.length-1)]; }
  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){ var j=rand(0,i); var t=a[i]; a[i]=a[j]; a[j]=t; }
    return a;
  }
  function dist(p,q){ return Math.hypot(p.x-q.x, p.y-q.y); }
  function mid(p,q){ return {x:(p.x+q.x)/2, y:(p.y+q.y)/2}; }
  function centroidOf(pts){
    var sx=0, sy=0;
    pts.forEach(function(p){ sx+=p.x; sy+=p.y; });
    return {x:sx/pts.length, y:sy/pts.length};
  }
  function fmt(n){
    return (Math.round(n*100)/100).toString().replace(".", ",");
  }

  /* Perpendicular outward offset point for edge label */
  function edgeLabelPos(p1, p2, centroid, offset){
    offset = offset || 16;
    var mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
    var dx=p2.x-p1.x, dy=p2.y-p1.y;
    var len = Math.hypot(dx,dy) || 1;
    var nx = -dy/len, ny = dx/len;
    var toCentroid = {x:centroid.x-mx, y:centroid.y-my};
    var dot = nx*toCentroid.x + ny*toCentroid.y;
    if(dot > 0){ nx=-nx; ny=-ny; } // point away from centroid
    return {x:mx+nx*offset, y:my+ny*offset};
  }

  function vertexLabelPos(v, centroid, dist_){
    dist_ = dist_ || 26;
    var dx = centroid.x-v.x, dy = centroid.y-v.y;
    var len = Math.hypot(dx,dy) || 1;
    return {x: v.x + (dx/len)*dist_, y: v.y + (dy/len)*dist_};
  }

  function tickMarks(p1,p2,count,color){
    var out = "";
    var dx=p2.x-p1.x, dy=p2.y-p1.y;
    var len = Math.hypot(dx,dy) || 1;
    var ux=dx/len, uy=dy/len;
    var nx=-uy, ny=ux;
    var mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
    var spacing = 5;
    var start = -((count-1)/2)*spacing;
    for(var i=0;i<count;i++){
      var off = start + i*spacing;
      var cx = mx + ux*off, cy = my + uy*off;
      out += '<line class="tick" x1="'+(cx-nx*5)+'" y1="'+(cy-ny*5)+'" x2="'+(cx+nx*5)+'" y2="'+(cy+ny*5)+'" stroke="'+(color||"var(--ink)")+'"/>';
    }
    return out;
  }

  function rightAngleMarker(vertex, a, b, size){
    size = size || 13;
    function unit(p,q){ var dx=q.x-p.x, dy=q.y-p.y; var l=Math.hypot(dx,dy)||1; return {x:dx/l,y:dy/l}; }
    var u1 = unit(vertex,a), u2 = unit(vertex,b);
    var p1 = {x:vertex.x+u1.x*size, y:vertex.y+u1.y*size};
    var p2 = {x:vertex.x+u1.x*size+u2.x*size, y:vertex.y+u1.y*size+u2.y*size};
    var p3 = {x:vertex.x+u2.x*size, y:vertex.y+u2.y*size};
    return '<path class="right-angle" d="M '+p1.x+' '+p1.y+' L '+p2.x+' '+p2.y+' L '+p3.x+' '+p3.y+'"/>';
  }

  function normalizeAndScale(pts, viewW, viewH, pad){
    viewW = viewW || 300; viewH = viewH || 220; pad = pad===undefined?34:pad;
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    pts.forEach(function(p){
      if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
      if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
    });
    var w = maxX-minX || 1, h = maxY-minY || 1;
    var scale = Math.min((viewW-2*pad)/w, (viewH-2*pad)/h);
    var offX = (viewW - w*scale)/2 - minX*scale;
    var offY = (viewH - h*scale)/2 - minY*scale;
    return pts.map(function(p){ return {x:p.x*scale+offX, y:p.y*scale+offY}; });
  }

  var COLORS = {
    dreieck: {main:"var(--triangle)", soft:"var(--triangle-soft)"},
    viereck: {main:"var(--viereck)", soft:"var(--viereck-soft)"},
    kreis: {main:"var(--kreis)", soft:"var(--kreis-soft)"},
    koerper: {main:"var(--koerper)", soft:"var(--koerper-soft)"},
    bruch: {main:"var(--bruch)", soft:"var(--bruch-soft)"},
    prozent: {main:"var(--prozent)", soft:"var(--prozent-soft)"},
    textaufgabe: {main:"var(--textaufgabe)", soft:"var(--textaufgabe-soft)"},
    gleichung: {main:"var(--gleichung)", soft:"var(--gleichung-soft)"}
  };

  /* Build full SVG markup for a polygon with optional side/angle labels & marks */
  function polygonSVG(pts, opts){
    opts = opts || {};
    var color = opts.color || "var(--ink)";
    var soft = opts.soft || "var(--paper)";
    var centroid = centroidOf(pts);
    var pointStr = pts.map(function(p){ return p.x+","+p.y; }).join(" ");
    var pathD = "M " + pts.map(function(p){return p.x+" "+p.y;}).join(" L ") + " Z";

    var extras = "";

    // side labels
    if(opts.sideLabels){
      for(var i=0;i<pts.length;i++){
        var a = pts[i], b = pts[(i+1)%pts.length];
        var lbl = opts.sideLabels[i];
        if(lbl===undefined || lbl===null) continue;
        var pos = edgeLabelPos(a,b,centroid, opts.labelOffset||17);
        extras += '<text class="dim-label" x="'+pos.x+'" y="'+pos.y+'" text-anchor="middle" dominant-baseline="middle">'+lbl+'</text>';
      }
    }

    // tick marks: opts.ticks = array (same length as pts) of counts, 0 = none
    if(opts.ticks){
      for(var t=0;t<pts.length;t++){
        var cnt = opts.ticks[t];
        if(cnt>0){
          var a2 = pts[t], b2 = pts[(t+1)%pts.length];
          extras += tickMarks(a2,b2,cnt,color);
        }
      }
    }

    // right angle marker at vertex index
    if(opts.rightAngleAt !== undefined && opts.rightAngleAt !== null){
      var idx = opts.rightAngleAt;
      var prev = pts[(idx-1+pts.length)%pts.length];
      var nxt = pts[(idx+1)%pts.length];
      extras += rightAngleMarker(pts[idx], prev, nxt, 14);
    }

    // vertex angle value labels: opts.angleLabels = array parallel to pts, string or null
    if(opts.angleLabels){
      for(var v=0; v<pts.length; v++){
        var al = opts.angleLabels[v];
        if(al===undefined || al===null) continue;
        var vp = vertexLabelPos(pts[v], centroid, opts.angleDist || 30);
        extras += '<text class="angle-label" x="'+vp.x+'" y="'+vp.y+'" text-anchor="middle" dominant-baseline="middle" fill="#444444">'+al+'</text>';
      }
    }

    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
      '<path class="shape-outline" d="'+pathD+'" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5" stroke-linejoin="round"/>' +
      extras +
      '</svg>';
    return svg;
  }

  function renderFigure(svgMarkup, badgeText, badgeColor){
    var host = document.getElementById("figureHost");
    host.innerHTML = svgMarkup;
    var badge = document.getElementById("topicBadge");
    badge.textContent = badgeText;
    badge.style.background = badgeColor;
    var paths = host.querySelectorAll("path.shape-outline");
    paths.forEach(function(path){
      if(path && path.getTotalLength){
        var len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.getBoundingClientRect(); // force reflow
        path.style.transition = "stroke-dashoffset 0.9s cubic-bezier(.3,.7,.3,1)";
        requestAnimationFrame(function(){ path.style.strokeDashoffset = "0"; });
      }
    });
  }

  /* ============ Neue Zeichen-Helfer: Kreis, Körper, Bruch-/Prozent-Balken ============ */

  function circleFigureSVG(rValue, given, color, soft){
    // rValue: die angegebene Zahl (Radius oder Durchmesser je nach 'given')
    var r = given==="d" ? rValue/2 : rValue;
    var scale = 8; // px pro cm, angepasst für r bis ~10cm im 300x220-Feld
    var Rpx = Math.min(r*scale, 85);
    var cx=150, cy=112;
    var pathD = "M "+(cx+Rpx)+" "+cy+" A "+Rpx+" "+Rpx+" 0 1 0 "+(cx-Rpx)+" "+cy+" A "+Rpx+" "+Rpx+" 0 1 0 "+(cx+Rpx)+" "+cy;
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<path class="shape-outline" d="'+pathD+'" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5"/>';
    svg += '<circle cx="'+cx+'" cy="'+cy+'" r="2.5" fill="'+color+'"/>';
    if(given==="d"){
      svg += '<line class="measure-line" x1="'+(cx-Rpx)+'" y1="'+cy+'" x2="'+(cx+Rpx)+'" y2="'+cy+'"/>';
      svg += '<text class="dim-label" x="'+cx+'" y="'+(cy-10)+'" text-anchor="middle">d = '+rValue+' cm</text>';
    } else {
      svg += '<line class="measure-line" x1="'+cx+'" y1="'+cy+'" x2="'+(cx+Rpx)+'" y2="'+cy+'"/>';
      svg += '<text class="dim-label" x="'+(cx+Rpx/2)+'" y="'+(cy-10)+'" text-anchor="middle">r = '+rValue+' cm</text>';
    }
    svg += '</svg>';
    return svg;
  }

  /* Schematischer Quader/Würfel in Kavalierprojektion (Vorder-, Deck- und Seitenfläche) */
  function boxFigureSVG(l,b,h, color, soft, isCube){
    var scale = Math.min(150/Math.max(l,h,6), 12);
    var w = l*scale, hh = h*scale;
    var dep = Math.min(b*scale*0.55, 55); // gestauchte Tiefe für die Optik, feste Obergrenze
    var ang = 32*Math.PI/180;
    var ddx = dep*Math.cos(ang), ddy = -dep*Math.sin(ang);
    var x0 = 62, y0 = 150-hh; // front-top-left als Referenz -> unten ausrichten
    var FTL={x:x0,y:y0}, FTR={x:x0+w,y:y0}, FBR={x:x0+w,y:y0+hh}, FBL={x:x0,y:y0+hh};
    var BTL={x:FTL.x+ddx,y:FTL.y+ddy}, BTR={x:FTR.x+ddx,y:FTR.y+ddy}, BBR={x:FBR.x+ddx,y:FBR.y+ddy};

    function poly(pts){ return pts.map(function(p){return p.x+" "+p.y;}).join(" L "); }
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    // Deckfläche (oben) - etwas heller
    svg += '<path d="M '+poly([FTL,FTR,BTR,BTL])+' Z" fill="'+soft+'" fill-opacity="0.55" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    // Seitenfläche (rechts) - etwas dunkler
    svg += '<path d="M '+poly([FTR,FBR,BBR,BTR])+' Z" fill="'+color+'" fill-opacity="0.28" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    // Vorderfläche - Haupt-Reveal-Pfad
    svg += '<path class="shape-outline" d="M '+poly([FTL,FTR,FBR,FBL])+' Z" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5" stroke-linejoin="round"/>';

    if(isCube){
      svg += '<text class="dim-label" x="'+((FBL.x+FBR.x)/2)+'" y="'+(FBL.y+16)+'" text-anchor="middle">a = '+l+' cm</text>';
      svg += tickMarks(FBL,FBR,1,color);
      svg += tickMarks(FTL,FBL,1,color);
      svg += tickMarks(FBR,BBR,1,color);
    } else {
      svg += '<text class="dim-label" x="'+((FBL.x+FBR.x)/2)+'" y="'+(FBL.y+16)+'" text-anchor="middle">l = '+l+' cm</text>';
      svg += '<text class="dim-label" x="'+(FTL.x-8)+'" y="'+((FTL.y+FBL.y)/2)+'" text-anchor="end" dominant-baseline="middle">h = '+h+' cm</text>';
      svg += '<text class="dim-label" x="'+((FBR.x+BBR.x)/2+6)+'" y="'+((FBR.y+BBR.y)/2+12)+'" text-anchor="start">b = '+b+' cm</text>';
    }
    svg += '</svg>';
    return svg;
  }

  /* Schematischer Zylinder (zwei Ellipsen + Höhenlinien) */
  function cylinderFigureSVG(r,h,color,soft){
    var scaleR = Math.min(70/Math.max(r,4), 14);
    var Rpx = r*scaleR;
    var Hpx = Math.min(h*10, 140);
    var cx = 150, topY = 45;
    var ry = Math.max(Rpx*0.32, 10);
    var botY = topY+Hpx;
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<path class="shape-outline" d="M '+(cx-Rpx)+' '+topY+' L '+(cx-Rpx)+' '+botY+' M '+(cx+Rpx)+' '+topY+' L '+(cx+Rpx)+' '+botY+'" fill="none" stroke="'+color+'" stroke-width="3.5"/>';
    svg += '<ellipse cx="'+cx+'" cy="'+botY+'" rx="'+Rpx+'" ry="'+ry+'" fill="'+soft+'" stroke="'+color+'" stroke-width="3"/>';
    svg += '<ellipse cx="'+cx+'" cy="'+topY+'" rx="'+Rpx+'" ry="'+ry+'" fill="'+soft+'" stroke="'+color+'" stroke-width="3"/>';
    svg += '<line class="measure-line" x1="'+cx+'" y1="'+topY+'" x2="'+(cx+Rpx)+'" y2="'+topY+'"/>';
    svg += '<text class="dim-label" x="'+(cx+Rpx/2)+'" y="'+(topY-8)+'" text-anchor="middle">r = '+r+' cm</text>';
    svg += '<line class="measure-line" x1="'+(cx-Rpx-14)+'" y1="'+topY+'" x2="'+(cx-Rpx-14)+'" y2="'+botY+'"/>';
    svg += '<text class="dim-label" x="'+(cx-Rpx-22)+'" y="'+((topY+botY)/2)+'" text-anchor="end" dominant-baseline="middle">h = '+h+' cm</text>';
    svg += '</svg>';
    return svg;
  }

  /* Bruchbalken: Rechteck in 'denom' gleiche Teile geteilt, 'num' davon eingefärbt */
  function fractionBarSVG(num, denom, color, soft, y){
    y = y===undefined? 70 : y;
    var x0=30, w=240, h=60;
    var segW = w/denom;
    var svg = "";
    for(var i=0;i<denom;i++){
      var fill = i<num ? color : soft;
      svg += '<rect x="'+(x0+i*segW)+'" y="'+y+'" width="'+segW+'" height="'+h+'" fill="'+fill+'" stroke="var(--ink)" stroke-width="1.5"/>';
    }
    svg += '<rect class="shape-outline" x="'+x0+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="var(--ink)" stroke-width="3"/>';
    return svg;
  }

  function fractionFigureSVG(num, denom, color, soft){
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += fractionBarSVG(num,denom,color,soft,80);
    svg += '<text class="dim-label" x="150" y="60" text-anchor="middle" font-size="16">'+num+' / '+denom+'</text>';
    svg += '</svg>';
    return svg;
  }

  function fractionPairFigureSVG(num1,denom1,num2,denom2,color,soft){
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<text class="dim-label" x="150" y="35" text-anchor="middle" font-size="14">'+num1+'/'+denom1+'</text>';
    svg += fractionBarSVG(num1,denom1,color,soft,45);
    svg += '<text class="dim-label" x="150" y="130" text-anchor="middle" font-size="14">'+num2+'/'+denom2+'</text>';
    svg += fractionBarSVG(num2,denom2,color,soft,140);
    svg += '</svg>';
    return svg;
  }

  /* Prozentbalken: Anteil 'part' von 'total' eingefärbt */
  function percentBarSVG(part, total, color, soft, caption){
    var x0=25, w=250, h=54, y=95;
    var pct = Math.max(0, Math.min(1, part/total));
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<rect x="'+x0+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+soft+'" stroke="var(--ink)" stroke-width="1.5"/>';
    svg += '<rect x="'+x0+'" y="'+y+'" width="'+(w*pct)+'" height="'+h+'" fill="'+color+'"/>';
    svg += '<rect class="shape-outline" x="'+x0+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="none" stroke="var(--ink)" stroke-width="3"/>';
    svg += '<text class="dim-label" x="150" y="'+(y-14)+'" text-anchor="middle">'+caption+'</text>';
    svg += '</svg>';
    return svg;
  }

  /* Einfache Datentabelle (für I3.M1 Tabellen lesen) */
  function tableSVG(headers, rows, color, soft){
    var cols = headers.length, rowsN = rows.length;
    var ch = 26;
    var gw = cols*80;
    var gx = (300-gw)/2, gy = 40;
    var s = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    for(var c=0;c<cols;c++){
      s += '<rect x="'+(gx+c*80)+'" y="'+gy+'" width="80" height="'+ch+'" fill="'+color+'" stroke="#fff" stroke-width="1.5"/>';
      s += '<text class="dim-label" x="'+(gx+c*80+40)+'" y="'+(gy+18)+'" text-anchor="middle" fill="#fff">'+headers[c]+'</text>';
    }
    for(var r=0;r<rowsN;r++){
      for(var c2=0;c2<cols;c2++){
        s += '<rect x="'+(gx+c2*80)+'" y="'+(gy+(r+1)*ch)+'" width="80" height="'+ch+'" fill="'+soft+'" stroke="#fff" stroke-width="1.5"/>';
        s += '<text class="dim-label" x="'+(gx+c2*80+40)+'" y="'+(gy+(r+1)*ch+18)+'" text-anchor="middle" fill="'+color+'">'+rows[r][c2]+'</text>';
      }
    }
    s += '</svg>';
    return s;
  }
  /* Säulendiagramm (für I3.M1) */
  function barChartSVG(labels, values, color, yMax){
    var n = values.length, bw = 40, gap = 15;
    var gw = n*(bw+gap)-gap, gx = (300-gw)/2, gy = 50, gh = 120;
    var s = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s += '<line x1="'+gx+'" y1="'+(gy+gh)+'" x2="'+(gx+gw)+'" y2="'+(gy+gh)+'" stroke="'+color+'" stroke-width="2.5"/>';
    for(var i=0;i<n;i++){
      var h = (values[i]/yMax)*gh;
      s += '<rect x="'+(gx+i*(bw+gap))+'" y="'+(gy+gh-h)+'" width="'+bw+'" height="'+h+'" fill="'+color+'" stroke="#fff" stroke-width="1.5"/>';
      s += '<text class="dim-label" x="'+(gx+i*(bw+gap)+bw/2)+'" y="'+(gy+gh+16)+'" text-anchor="middle" fill="'+color+'">'+labels[i]+'</text>';
      s += '<text class="dim-label" x="'+(gx+i*(bw+gap)+bw/2)+'" y="'+(gy+gh-h-5)+'" text-anchor="middle" fill="'+color+'">'+values[i]+'</text>';
    }
    s += '</svg>';
    return s;
  }


  function balanceSVG(leftLabel, rightLabel, color, soft){
    var s = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s += '<line x1="55" y1="78" x2="245" y2="78" stroke="'+color+'" stroke-width="4" stroke-linecap="round"/>';
    s += '<line x1="150" y1="78" x2="150" y2="150" stroke="'+color+'" stroke-width="4" stroke-linecap="round"/>';
    s += '<polygon points="135,150 165,150 150,162" fill="'+color+'"/>';
    s += '<path d="M 55 78 L 48 108 L 98 108 L 91 78 Z" fill="'+soft+'" stroke="'+color+'" stroke-width="2.5"/>';
    s += '<path d="M 209 78 L 202 108 L 252 108 L 245 78 Z" fill="'+soft+'" stroke="'+color+'" stroke-width="2.5"/>';
    s += '<text class="dim-label" x="73" y="132" text-anchor="middle" fill="'+color+'">'+leftLabel+'</text>';
    s += '<text class="dim-label" x="227" y="132" text-anchor="middle" fill="'+color+'">'+rightLabel+'</text>';
    s += '</svg>';
    return s;
  }



  function triangleFromSides(a,b,c){
    // c = AB (base), a = BC, b = CA
    var A = {x:0,y:0}, B = {x:c,y:0};
    var Cx = (b*b - a*a + c*c) / (2*c);
    var Cy2 = b*b - Cx*Cx;
    var Cy = Math.sqrt(Cy2 > 0.01 ? Cy2 : 0.01);
    var C = {x:Cx, y:-Cy};
    return [A,B,C];
  }

  function isValidTriangle(a,b,c){
    return (a+b>c) && (b+c>a) && (a+c>b);
  }

  function parallelogramFromSides(a,b,angleDeg){
    var rad = angleDeg*Math.PI/180;
    var A = {x:0,y:0};
    var B = {x:a,y:0};
    var D = {x:b*Math.cos(rad), y:-b*Math.sin(rad)};
    var C = {x:B.x+D.x, y:B.y+D.y};
    return [A,B,C,D];
  }

  /* Viereck exakt aus 4 Innenwinkeln konstruieren (Winkel alpha..delta an den Ecken A..D).
     Basis AB = 1; die Diagonale AC teilt den Winkel alpha bei A in zwei Teil-Dreiecke.
     Liefert null, wenn die Winkel keinen brauchbaren Konstruktionsraum ergeben. */
  function quadFromAngles(alpha, beta, gamma, delta){
    var lo = Math.max(0, alpha + delta - 180);
    var hi = Math.min(alpha, 180 - beta);
    if(hi - lo < 15) return null;
    var theta = lo + (hi - lo) * randf(0.35, 0.65);
    var rad = function(d){ return d*Math.PI/180; };
    // Dreieck ABC: AC = sin(beta) / sin(180-beta-theta) = sin(beta)/sin(beta+theta), mit AB = 1
    var AC = Math.sin(rad(beta)) / Math.sin(rad(beta + theta));
    // Dreieck ACD: Winkel bei C = 180 - alpha + theta - delta => AD = AC * sin(c2) / sin(delta)
    var c2 = 180 - alpha + theta - delta;
    var AD = AC * Math.sin(rad(c2)) / Math.sin(rad(delta));
    var A = {x:0, y:0}, B = {x:1, y:0};
    var C = {x:AC*Math.cos(rad(theta)), y:-AC*Math.sin(rad(theta))};
    var D = {x:AD*Math.cos(rad(alpha)), y:-AD*Math.sin(rad(alpha))};
    // Zu extreme Seitenverhältnisse ablehnen (Form sähe sonst entartet aus)
    var sides = [dist(A,B), dist(B,C), dist(C,D), dist(D,A)];
    var minS = Math.min.apply(null, sides), maxS = Math.max.apply(null, sides);
    if(minS/maxS < 0.18) return null;
    return [A,B,C,D];
  }

  /* Fixed illustrative templates (viewBox 300x220), used for recognition/property/angle demos */
  var TRI_TEMPLATES = {
    // Exakt aus den Ziel-Winkeln konstruiert (Sinussatz), damit die Zeichnung stimmt
    gleichseitig: (function(){ var t=triangleFromSides(1,1,1); return t.map(function(p){ return {x:p.x*140, y:p.y*140}; }); })(),
    gleichschenklig: [{x:150,y:26},{x:76,y:196},{x:224,y:196}],
    ungleichseitig: [{x:64,y:34},{x:40,y:196},{x:258,y:150}],
    rechtwinklig: [{x:64,y:34},{x:64,y:196},{x:252,y:196}],
    // 25° / 120° / 35° => Winkel bei B (Index 1) ist klar stumpf (~120° statt bisher ~113°)
    stumpfwinklig: (function(){ var s=function(d){ return Math.sin(d*Math.PI/180); }; var t=triangleFromSides(s(25)/s(35), s(120)/s(35), 1); return t.map(function(p){ return {x:p.x*140, y:p.y*150}; }); })(),
    spitzwinklig: [{x:150,y:56},{x:56,y:190},{x:244,y:190}]
  };
  var QUAD_TEMPLATES = {
    quadrat: [{x:92,y:42},{x:208,y:42},{x:208,y:158},{x:92,y:158}],
    rechteck: [{x:48,y:60},{x:252,y:60},{x:252,y:160},{x:48,y:160}],
    parallelogramm: [{x:78,y:52},{x:238,y:52},{x:198,y:170},{x:38,y:170}],
    raute: [{x:150,y:22},{x:230,y:112},{x:150,y:202},{x:70,y:112}],
    trapez: [{x:60,y:52},{x:220,y:52},{x:262,y:170},{x:18,y:170}],
    drachen: [{x:150,y:22},{x:222,y:104},{x:150,y:150},{x:78,y:104}]
  };

  var TRI_NAMES_SEITEN = {
    gleichseitig:"gleichseitig", gleichschenklig:"gleichschenklig",
    ungleichseitig:"ungleichseitig (unregelmäßig)", rechtwinklig:"ungleichseitig (unregelmäßig)",
    stumpfwinklig:"ungleichseitig (unregelmäßig)", spitzwinklig:"gleichschenklig"
  };
  var TRI_NAMES_WINKEL = {
    gleichseitig:"spitzwinklig", gleichschenklig:"spitzwinklig", ungleichseitig:"spitzwinklig",
    rechtwinklig:"rechtwinklig", stumpfwinklig:"stumpfwinklig", spitzwinklig:"spitzwinklig"
  };
  var QUAD_NAMES = {
    quadrat:"Quadrat", rechteck:"Rechteck", parallelogramm:"Parallelogramm",
    raute:"Raute", trapez:"Trapez", drachen:"Drachenviereck"
  };

  /* ============ Exercise generators ============ */

  // Globaler Schlüssel für das aktuelle Curriculum-Mapping
  // wird in GEN-Wrappern gesetzt, damit der Code in den Generatoren unverändert bleibt
  var _currentCurriculumKey = null;

  function baseEx(category, topic){
    return {category:category, topic:topic, curriculumKey:_currentCurriculumKey};
  }

  /* ============ Curriculum UI: Badge & Modal ============ */
  function updateCurriculumBadge(curriculumKey){
    var badge = document.getElementById("curriculumBadge");
    if(!badge) return;
    if(curriculumKey && CURRICULUM_MAP[curriculumKey]){
      badge.style.display = "flex";
      badge.dataset.curriculumKey = curriculumKey;
    } else {
      badge.style.display = "none";
    }
  }

  function openCurriculumModal(){
    var badge = document.getElementById("curriculumBadge");
    if(!badge) return;
    var key = badge.dataset.curriculumKey;
    if(!key || !CURRICULUM_MAP[key]) return;

    var mapping = CURRICULUM_MAP[key];
    var grades = GRADE_TAGS[key] || [];
    var body = document.getElementById("curriculumModalBody");

    var html = '<div class="curriculum-modal-block">';
    html += '<div class="kompetenz">Konkrete Kompetenz: <strong>'+mapping.kompetenz+'</strong></div>';
    html += '<div class="grades">📚 Schulstufe: ' + grades.map(function(g){ return g+". Klasse"; }).join(", ") + '</div>';
    html += '</div>';

    html += '<div style="font-weight:600; margin: 12px 0 8px;">Zugeordnete Bildungsstandards (BMBWF):</div>';
    mapping.codes.forEach(function(code){
      html += '<div class="curriculum-block">';
      html += '<div class="code">Code: '+code+'</div>';
      html += '<div class="desc">'+LEHRPLAN[code]+'</div>';
      html += '</div>';
    });

    html += '<div style="margin-top:14px; padding-top:12px; border-top:1px dashed var(--line); font-size:.78rem; color:var(--muted);">';
    html += 'Referenz: <em>BMBWF Lehrplan 2023 – Mathematik, AHS-Unterstufe / Mittelschule. Kompetenzbereiche H1–H4 (Handlungsdimension) und I1–I3 (Inhaltsdimension).</em>';
    html += '</div>';

    body.innerHTML = html;
    document.getElementById("curriculumModal").style.display = "flex";
  }

  function closeCurriculumModal(){
    document.getElementById("curriculumModal").style.display = "none";
  }

  // 1) Winkelsumme im Dreieck (Dreieck exakt aus den echten Winkeln konstruiert)
  function genDreieckWinkel(){
    var a,b,c;
    do{
      a = rand(25,120); b = rand(25,120); c = 180-a-b;
    } while(c<20 || c>130);
    // Aus den 3 Winkeln exakt konstruieren (Basis AB = c-Anteil, Sinussatz):
    // Winkel a liegt bei A, b bei B, c bei C -> Labels stimmen mit der Zeichnung überein
    var base = 100;
    var aS = base * Math.sin(a*Math.PI/180) / Math.sin(c*Math.PI/180); // Seite BC (gegenüber α)
    var bS = base * Math.sin(b*Math.PI/180) / Math.sin(c*Math.PI/180); // Seite CA (gegenüber β)
    var raw = triangleFromSides(aS, bS, base);
    var pts = normalizeAndScale(raw,300,220,36);
    var missingIdx = rand(0,2);
    var vals = [a,b,c];
    var labels = vals.map(function(v,i){ return i===missingIdx ? "?" : v+"°"; });
    var svg = polygonSVG(pts, {
      color:COLORS.dreieck.main, soft:COLORS.dreieck.soft,
      angleLabels: labels, angleDist: 30
    });
    var ex = baseEx("dreieck","winkel");
    ex.question = "In diesem Dreieck kennst du zwei Winkel. Wie groß ist der fehlende Winkel?";
    ex.hint = "Merke dir: Die Winkelsumme im Dreieck beträgt immer 180°. Die Skizze entspricht den echten Winkeln.";
    ex.svg = svg; ex.badge="Dreieck · Winkel"; ex.badgeColor=COLORS.dreieck.main;
    ex.inputType="number"; ex.unit="°"; ex.answer = vals[missingIdx];
    ex.explanation = "Rechnung: 180° − "+vals[(missingIdx+1)%3]+"° − "+vals[(missingIdx+2)%3]+"° = "+vals[missingIdx]+"°.";
    return ex;
  }

  // 2) Winkelsumme im Viereck (Viereck exakt aus den echten Winkeln konstruiert)
  function genViereckWinkel(){
    var vals = null, pts = null;
    for(var tries=0; tries<500 && !pts; tries++){
      var a=rand(50,140), b=rand(50,140), c=rand(50,140), d=360-a-b-c;
      if(d<40 || d>150) continue;
      var cand=[a,b,c,d];
      pts = quadFromAngles(a,b,c,d);
      if(pts) vals = cand;
    }
    if(!vals){ // Fallback: immer konstruierbare Winkel, damit nie eine leere Skizze entsteht
      vals = [80,100,90,90];
      pts = quadFromAngles(vals[0], vals[1], vals[2], vals[3]);
    }
    pts = normalizeAndScale(pts,300,220,38);
    var missingIdx = rand(0,3);
    var labels = vals.map(function(v,i){ return i===missingIdx?"?":v+"°"; });
    var svg = polygonSVG(pts, {color:COLORS.viereck.main, soft:COLORS.viereck.soft, angleLabels:labels, angleDist:28});
    var ex = baseEx("viereck","winkel");
    ex.question = "In diesem Viereck kennst du drei Winkel. Wie groß ist der vierte Winkel?";
    ex.hint = "Merke dir: Die Winkelsumme im Viereck beträgt immer 360°. Die Skizze entspricht den echten Winkeln.";
    ex.svg=svg; ex.badge="Viereck · Winkel"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="number"; ex.unit="°"; ex.answer=vals[missingIdx];
    var others = vals.filter(function(_,i){return i!==missingIdx;});
    ex.explanation = "Rechnung: 360° − "+others.join("° − ")+"° = "+vals[missingIdx]+"°.";
    return ex;
  }

  // 3) Umfang Dreieck (scalene, exact construction)
  function genDreieckUmfang(){
    var a,b,c;
    do{
      a=rand(4,12); b=rand(4,12); c=rand(4,12);
    } while(!isValidTriangle(a,b,c) || (a===b && b===c));
    var raw = triangleFromSides(a,b,c);
    var pts = normalizeAndScale(raw,300,220,36);
    var svg = polygonSVG(pts, {
      color:COLORS.dreieck.main, soft:COLORS.dreieck.soft,
      sideLabels:[c+" cm", a+" cm", b+" cm"], labelOffset:16
    });
    var ex = baseEx("dreieck","umfang");
    ex.question = "Berechne den Umfang dieses Dreiecks.";
    ex.hint = "Der Umfang ist die Summe aller Seitenlängen.";
    ex.svg=svg; ex.badge="Dreieck · Umfang"; ex.badgeColor=COLORS.dreieck.main;
    ex.inputType="number"; ex.unit="cm"; ex.answer=a+b+c;
    ex.explanation = "U = a + b + c = "+a+" cm + "+b+" cm + "+c+" cm = "+(a+b+c)+" cm.";
    return ex;
  }

  // 4) Umfang Viereck (Quadrat/Rechteck)
  function genViereckUmfang(){
    var isSquare = Math.random()<0.4;
    var a = rand(3,12), b = isSquare? a : rand(3,12);
    while(!isSquare && b===a){ b = rand(3,12); }
    var maxDim = Math.max(a,b);
    var scale = 170/maxDim;
    var w=a*scale, h=b*scale;
    var x0=(300-w)/2, y0=(220-h)/2;
    var pts=[{x:x0,y:y0},{x:x0+w,y:y0},{x:x0+w,y:y0+h},{x:x0,y:y0+h}];
    var svg = polygonSVG(pts, {
      color:COLORS.viereck.main, soft:COLORS.viereck.soft,
      sideLabels:[a+" cm", b+" cm", a+" cm", b+" cm"], labelOffset:16,
      ticks: isSquare? [1,1,1,1] : [1,2,1,2]
    });
    var ex = baseEx("viereck","umfang");
    ex.question = isSquare
      ? "Berechne den Umfang dieses Quadrats."
      : "Berechne den Umfang dieses Rechtecks.";
    ex.hint = isSquare ? "Beim Quadrat sind alle 4 Seiten gleich lang: U = 4 · a." : "Beim Rechteck gilt: U = 2 · (a + b).";
    ex.svg=svg; ex.badge = isSquare? "Quadrat · Umfang":"Rechteck · Umfang"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="number"; ex.unit="cm";
    ex.answer = isSquare ? 4*a : 2*(a+b);
    ex.explanation = isSquare
      ? "U = 4 · a = 4 · "+a+" cm = "+(4*a)+" cm."
      : "U = 2 · (a + b) = 2 · ("+a+" cm + "+b+" cm) = "+(2*(a+b))+" cm.";
    return ex;
  }

  // 5) Fläche Dreieck (Grundlinie × Höhe / 2)
  function genDreieckFlaeche(){
    var g = rand(4,14), h = rand(3,12);
    var scale = 170/Math.max(g,h,10);
    var gW = g*scale, hH = h*scale;
    var baseY = 190;
    var Bx = (300-gW)/2, By = baseY;
    var Cx = Bx+gW, Cy = baseY;
    var apexOffset = rand(-Math.floor(gW*0.3), Math.floor(gW*0.3));
    var Ax = Bx + gW/2 + apexOffset, Ay = baseY - hH;
    var footX = Bx + gW/2 + apexOffset;
    var pts = [{x:Ax,y:Ay},{x:Bx,y:By},{x:Cx,y:Cy}];
    var centroid = centroidOf(pts);
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    var pathD = "M "+Ax+" "+Ay+" L "+Bx+" "+By+" L "+Cx+" "+Cy+" Z";
    svg += '<path class="shape-outline" d="'+pathD+'" fill="'+COLORS.dreieck.soft+'" stroke="'+COLORS.dreieck.main+'" stroke-width="3.5" stroke-linejoin="round"/>';
    svg += '<line class="measure-line" x1="'+footX+'" y1="'+Ay+'" x2="'+footX+'" y2="'+By+'"/>';
    if(footX>=Bx-1 && footX<=Cx+1){
      svg += rightAngleMarker({x:footX,y:By}, {x:footX,y:Ay}, {x:footX> (Bx+Cx)/2 ? Bx: Cx, y:By}, 12);
    }
    var baseLabel = edgeLabelPos({x:Bx,y:By},{x:Cx,y:Cy}, centroid, 18);
    svg += '<text class="dim-label" x="'+baseLabel.x+'" y="'+baseLabel.y+'" text-anchor="middle">g = '+g+' cm</text>';
    svg += '<text class="dim-label" x="'+(footX+10)+'" y="'+((Ay+By)/2)+'" text-anchor="start" dominant-baseline="middle">h = '+h+' cm</text>';
    svg += '</svg>';

    var ex = baseEx("dreieck","flaeche");
    ex.question = "Berechne die Fläche dieses Dreiecks.";
    ex.hint = "Formel: A = (Grundlinie · Höhe) : 2.";
    ex.svg=svg; ex.badge="Dreieck · Fläche"; ex.badgeColor=COLORS.dreieck.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = (g*h)/2;
    ex.explanation = "A = (g · h) : 2 = ("+g+" cm · "+h+" cm) : 2 = "+fmt((g*h)/2)+" cm².";
    ex._svgIsPath = true;
    return ex;
  }

  // 6) Fläche Rechteck / Quadrat
  function genRechteckFlaeche(){
    var isSquare = Math.random()<0.4;
    var a = rand(3,12), b = isSquare? a : rand(3,12);
    while(!isSquare && b===a){ b=rand(3,12); }
    var maxDim=Math.max(a,b);
    var scale=170/maxDim;
    var w=a*scale, h=b*scale;
    var x0=(300-w)/2, y0=(220-h)/2;
    var pts=[{x:x0,y:y0},{x:x0+w,y:y0},{x:x0+w,y:y0+h},{x:x0,y:y0+h}];
    var svg = polygonSVG(pts,{
      color:COLORS.viereck.main, soft:COLORS.viereck.soft,
      sideLabels:[a+" cm", b+" cm", a+" cm", b+" cm"], labelOffset:16,
      ticks: isSquare?[1,1,1,1]:[1,2,1,2]
    });
    var ex = baseEx("viereck","flaeche");
    ex.question = isSquare ? "Berechne die Fläche dieses Quadrats." : "Berechne die Fläche dieses Rechtecks.";
    ex.hint = isSquare ? "Formel: A = a · a." : "Formel: A = a · b.";
    ex.svg=svg; ex.badge=isSquare?"Quadrat · Fläche":"Rechteck · Fläche"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = a*b;
    ex.explanation = isSquare
      ? "A = a · a = "+a+" cm · "+a+" cm = "+(a*a)+" cm²."
      : "A = a · b = "+a+" cm · "+b+" cm = "+(a*b)+" cm².";
    return ex;
  }

  // 7) Fläche Parallelogramm
  function genParallelogrammFlaeche(){
    var g = rand(5,14), h = rand(3,10);
    var scale = 170/Math.max(g,h,10);
    var gW=g*scale, hH=h*scale;
    var slant = rand(20,60);
    var Bx=(300-gW-slant)/2, By=170;
    var Cx=Bx+gW, Cy=170;
    var Dx=Cx-slant, Dy=170-hH;
    var Ax=Bx-slant, Ay=170-hH;
    var pts=[{x:Ax,y:Ay},{x:Bx,y:By},{x:Cx,y:Cy},{x:Dx,y:Dy}];
    var centroid = centroidOf(pts);
    var svg='<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    var pathD="M "+pts.map(function(p){return p.x+" "+p.y;}).join(" L ")+" Z";
    svg+='<path class="shape-outline" d="'+pathD+'" fill="'+COLORS.viereck.soft+'" stroke="'+COLORS.viereck.main+'" stroke-width="3.5" stroke-linejoin="round"/>';
    var footX = Bx + slant*0; // foot directly below D
    var Fx = Dx, Fy = By;
    svg += '<line class="measure-line" x1="'+Dx+'" y1="'+Dy+'" x2="'+Fx+'" y2="'+Fy+'"/>';
    svg += rightAngleMarker({x:Fx,y:Fy},{x:Fx,y:Dy},{x:Cx,y:Cy},12);
    var baseLbl = edgeLabelPos(pts[1],pts[2],centroid,18);
    svg += '<text class="dim-label" x="'+baseLbl.x+'" y="'+baseLbl.y+'" text-anchor="middle">g = '+g+' cm</text>';
    svg += '<text class="dim-label" x="'+(Fx-14)+'" y="'+((Dy+By)/2)+'" text-anchor="end" dominant-baseline="middle">h = '+h+' cm</text>';
    svg += tickMarks(pts[0],pts[1],1,COLORS.viereck.main);
    svg += tickMarks(pts[2],pts[3],1,COLORS.viereck.main);
    svg += '</svg>';

    var ex = baseEx("viereck","flaeche");
    ex.question = "Berechne die Fläche dieses Parallelogramms.";
    ex.hint = "Formel: A = Grundlinie · Höhe.";
    ex.svg=svg; ex.badge="Parallelogramm · Fläche"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = g*h;
    ex.explanation = "A = g · h = "+g+" cm · "+h+" cm = "+(g*h)+" cm².";
    return ex;
  }

  // 8) Fläche Trapez (maßstabsgetreu aus a, c, h konstruiert)
  function genTrapezFlaeche(){
    var a = rand(8,16); // lange parallele Seite (unten)
    var c = rand(3,a-2); // kurze parallele Seite (oben)
    var h = rand(3,10);
    var scale = 170/Math.max(a,c,h,10);
    var aW = a*scale, cW = c*scale, hH = h*scale;
    var baseY = 190;
    var Bx = (300-aW)/2, By = baseY;        // unten links
    var Cx = Bx+aW,      Cy = baseY;        // unten rechts
    var Ax = (300-cW)/2, Ay = baseY-hH;     // oben links
    var Dx = Ax+cW,      Dy = Ay;           // oben rechts
    // Seiten-Reihenfolge wie beim alten Template: oben (c), rechts unten, unten (a), links unten
    var pts = [{x:Ax,y:Ay},{x:Dx,y:Dy},{x:Cx,y:Cy},{x:Bx,y:By}];
    var centroid = centroidOf(pts);
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    var pathD = "M "+pts.map(function(p){return p.x+" "+p.y;}).join(" L ")+" Z";
    svg += '<path class="shape-outline" d="'+pathD+'" fill="'+COLORS.viereck.soft+'" stroke="'+COLORS.viereck.main+'" stroke-width="3.5" stroke-linejoin="round"/>';
    var topLbl = edgeLabelPos(pts[0],pts[1],centroid,16);
    var botLbl = edgeLabelPos(pts[2],pts[3],centroid,16);
    svg += '<text class="dim-label" x="'+topLbl.x+'" y="'+topLbl.y+'" text-anchor="middle">c = '+c+' cm</text>';
    svg += '<text class="dim-label" x="'+botLbl.x+'" y="'+botLbl.y+'" text-anchor="middle">a = '+a+' cm</text>';
    // Höhen-Linie am linken Rand: senkrecht vom oberen Eck bis zur Grundlinie
    svg += '<line class="measure-line" x1="'+Ax+'" y1="'+Ay+'" x2="'+Ax+'" y2="'+By+'"/>';
    if(Ax > Bx+3 && Ax < Cx-3){
      svg += rightAngleMarker({x:Ax,y:By}, {x:Ax,y:Ay}, {x:Cx,y:Cy}, 11);
    }
    var midLeft = mid(pts[0],pts[3]);
    svg += '<text class="dim-label" x="'+(midLeft.x-8)+'" y="'+(midLeft.y)+'" text-anchor="end">h = '+h+' cm</text>';
    svg += '</svg>';

    var ex = baseEx("viereck","flaeche");
    ex.question = "Berechne die Fläche dieses Trapezes.";
    ex.hint = "Formel: A = ((a + c) : 2) · h, wobei a und c die parallelen Seiten sind.";
    ex.svg=svg; ex.badge="Trapez · Fläche"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = ((a+c)/2)*h;
    ex.explanation = "A = ((a + c) : 2) · h = (("+a+" + "+c+") : 2) · "+h+" = "+fmt(((a+c)/2)*h)+" cm².";
    return ex;
  }

  // 9) Dreieck erkennen (nach Seiten ODER nach Winkeln)
  function genDreieckErkennen(){
    var bySeiten = Math.random()<0.5;
    var key = choice(Object.keys(TRI_TEMPLATES));
    var pts = normalizeAndScale(TRI_TEMPLATES[key], 300, 220, 32);
    var ticks = null, rightAt = null;
    if(key==="gleichseitig") ticks=[1,1,1];
    if(key==="gleichschenklig" || key==="spitzwinklig") ticks=[1,0,1];
    if(key==="rechtwinklig") rightAt = 1;
    var svg = polygonSVG(pts, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:ticks, rightAngleAt:rightAt});
    var ex = baseEx("dreieck","erkennen");
    var correct = bySeiten ? TRI_NAMES_SEITEN[key] : TRI_NAMES_WINKEL[key];
    var allSeiten = ["gleichseitig","gleichschenklig","ungleichseitig (unregelmäßig)"];
    var allWinkel = ["spitzwinklig","rechtwinklig","stumpfwinklig"];
    var pool = bySeiten ? allSeiten : allWinkel;
    var wrongOptions = pool.filter(function(o){ return o!==correct; });
    var options = shuffle([correct].concat(wrongOptions));
    ex.question = bySeiten
      ? "Wie wird dieses Dreieck nach seinen Seitenlängen genannt?"
      : "Wie wird dieses Dreieck nach seinen Winkeln genannt?";
    ex.hint = bySeiten
      ? "Achte auf die Markierungen: gleich viele Striche = gleich lange Seiten."
      : "Achte auf das kleine Quadrat – es zeigt einen rechten Winkel (90°).";
    ex.svg=svg; ex.badge="Dreieck · Erkennen"; ex.badgeColor=COLORS.dreieck.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
    ex.explanation = "Richtig ist: "+correct+".";
    return ex;
  }

  // 10) Viereck erkennen
  function genViereckErkennen(){
    var key = choice(Object.keys(QUAD_TEMPLATES));
    var pts = normalizeAndScale(QUAD_TEMPLATES[key], 300, 220, 30);
    var ticks = null;
    if(key==="quadrat" || key==="raute") ticks=[1,1,1,1];
    if(key==="rechteck" || key==="parallelogramm") ticks=[1,2,1,2];
    if(key==="drachen") ticks=[1,1,2,2];
    var rightAt = (key==="quadrat"||key==="rechteck") ? 0 : null;
    var svg = polygonSVG(pts,{color:COLORS.viereck.main, soft:COLORS.viereck.soft, ticks:ticks, rightAngleAt:rightAt});
    var correct = QUAD_NAMES[key];
    var pool = Object.values(QUAD_NAMES).filter(function(o){return o!==correct;});
    var wrongs = shuffle(pool).slice(0,3);
    var options = shuffle([correct].concat(wrongs));
    var ex = baseEx("viereck","erkennen");
    ex.question = "Wie heißt dieses Viereck?";
    ex.hint = "Schau dir Seitenlängen (Striche) und Winkel (Quadrat = rechter Winkel) genau an.";
    ex.svg=svg; ex.badge="Viereck · Erkennen"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
    ex.explanation = "Richtig ist: "+correct+".";
    return ex;
  }

  // 11) Eigenschaften Dreieck (Wahr/Falsch als Multiple Choice)
  var TRI_STATEMENTS = [
    {t:"Ein gleichseitiges Dreieck hat drei gleich lange Seiten.", v:true},
    {t:"Ein gleichseitiges Dreieck hat drei gleich große Winkel (je 60°).", v:true},
    {t:"Ein gleichschenkliges Dreieck hat immer einen rechten Winkel.", v:false},
    {t:"In jedem Dreieck beträgt die Winkelsumme 180°.", v:true},
    {t:"Ein rechtwinkliges Dreieck hat genau einen Winkel von 90°.", v:true},
    {t:"Ein stumpfwinkliges Dreieck hat einen Winkel, der größer als 90° ist.", v:true},
    {t:"Ein Dreieck kann zwei rechte Winkel haben.", v:false},
    {t:"Ein gleichschenkliges Dreieck hat mindestens zwei gleich lange Seiten.", v:true},
    {t:"In einem spitzwinkligen Dreieck sind alle Winkel kleiner als 90°.", v:true},
    {t:"Ein ungleichseitiges Dreieck hat drei unterschiedlich lange Seiten.", v:true}
  ];
  var QUAD_STATEMENTS = [
    {t:"Ein Quadrat hat vier gleich lange Seiten und vier rechte Winkel.", v:true},
    {t:"Ein Rechteck hat immer vier gleich lange Seiten.", v:false},
    {t:"Bei einem Parallelogramm sind gegenüberliegende Seiten gleich lang und parallel.", v:true},
    {t:"Eine Raute hat vier gleich lange Seiten, aber nicht zwingend rechte Winkel.", v:true},
    {t:"Ein Trapez hat mindestens ein Paar paralleler Seiten.", v:true},
    {t:"Die Winkelsumme in jedem Viereck beträgt 360°.", v:true},
    {t:"Jedes Quadrat ist auch ein Rechteck.", v:true},
    {t:"Jedes Rechteck ist auch ein Quadrat.", v:false},
    {t:"Ein Drachenviereck hat zwei Paare gleich langer, benachbarter Seiten.", v:true},
    {t:"Bei einem Parallelogramm sind alle vier Winkel gleich groß.", v:false}
  ];

  function genEigenschaftenDreieck(){
    var s = choice(TRI_STATEMENTS);
    var key = choice(Object.keys(TRI_TEMPLATES));
    var pts = normalizeAndScale(TRI_TEMPLATES[key],300,220,32);
    var svg = polygonSVG(pts,{color:COLORS.dreieck.main, soft:COLORS.dreieck.soft});
    var ex = baseEx("dreieck","eigenschaften");
    ex.question = "Wahr oder falsch? \""+s.t+"\"";
    ex.hint = "Denk an die Eigenschaften von Dreiecksarten.";
    ex.svg=svg; ex.badge="Dreieck · Aussage"; ex.badgeColor=COLORS.dreieck.main;
    ex.inputType="mc"; ex.choices=["Wahr","Falsch"];
    ex.correctIndex = s.v ? 0 : 1;
    ex.explanation = s.v ? "Die Aussage stimmt." : "Die Aussage stimmt nicht.";
    return ex;
  }
  function genEigenschaftenViereck(){
    var s = choice(QUAD_STATEMENTS);
    var key = choice(Object.keys(QUAD_TEMPLATES));
    var pts = normalizeAndScale(QUAD_TEMPLATES[key],300,220,30);
    var svg = polygonSVG(pts,{color:COLORS.viereck.main, soft:COLORS.viereck.soft});
    var ex = baseEx("viereck","eigenschaften");
    ex.question = "Wahr oder falsch? \""+s.t+"\"";
    ex.hint = "Denk an die Eigenschaften der Vierecksarten.";
    ex.svg=svg; ex.badge="Viereck · Aussage"; ex.badgeColor=COLORS.viereck.main;
    ex.inputType="mc"; ex.choices=["Wahr","Falsch"];
    ex.correctIndex = s.v ? 0 : 1;
    ex.explanation = s.v ? "Die Aussage stimmt." : "Die Aussage stimmt nicht.";
    return ex;
  }

  /* ============ Phase 3: Kreis ============ */

  function genKreisUmfang(){
    var r = rand(2,10);
    var given = Math.random()<0.4 ? "d" : "r";
    var value = given==="d" ? r*2 : r;
    var svg = circleFigureSVG(value, given, COLORS.kreis.main, COLORS.kreis.soft);
    var ex = baseEx("kreis","umfang");
    ex.question = given==="d"
      ? "Berechne den Umfang dieses Kreises (Durchmesser gegeben)."
      : "Berechne den Umfang dieses Kreises (Radius gegeben).";
    ex.hint = "Formel: U = 2 · π · r (bzw. U = π · d). Rechne mit π ≈ 3,14.";
    ex.svg=svg; ex.badge="Kreis · Umfang"; ex.badgeColor=COLORS.kreis.main;
    ex.inputType="number"; ex.unit="cm"; ex.tolerance=0.3;
    ex.answer = 2*Math.PI*r;
    ex.explanation = "U = 2 · π · r ≈ 2 · 3,14 · "+r+" cm = "+fmt(2*3.14*r)+" cm.";
    return ex;
  }

  function genKreisFlaeche(){
    var r = rand(2,10);
    var given = Math.random()<0.4 ? "d" : "r";
    var value = given==="d" ? r*2 : r;
    var svg = circleFigureSVG(value, given, COLORS.kreis.main, COLORS.kreis.soft);
    var ex = baseEx("kreis","flaeche");
    ex.question = given==="d"
      ? "Berechne die Fläche dieses Kreises (Durchmesser gegeben)."
      : "Berechne die Fläche dieses Kreises (Radius gegeben).";
    ex.hint = "Formel: A = π · r². Rechne mit π ≈ 3,14.";
    ex.svg=svg; ex.badge="Kreis · Fläche"; ex.badgeColor=COLORS.kreis.main;
    ex.inputType="number"; ex.unit="cm²"; ex.tolerance=Math.max(0.5, r*0.15);
    ex.answer = Math.PI*r*r;
    ex.explanation = "A = π · r² ≈ 3,14 · "+r+"² cm² = 3,14 · "+(r*r)+" cm² = "+fmt(3.14*r*r)+" cm².";
    return ex;
  }

  /* ============ Phase 3: Körper (Volumen) ============ */

  function genQuaderVolumen(){
    var l=rand(3,10), b=rand(2,8), h=rand(2,8);
    var svg = boxFigureSVG(l,b,h,COLORS.koerper.main,COLORS.koerper.soft,false);
    var ex = baseEx("koerper","volumen");
    ex.question = "Berechne das Volumen dieses Quaders.";
    ex.hint = "Formel: V = l · b · h. (Skizze schematisch)";
    ex.svg=svg; ex.badge="Quader · Volumen"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm³";
    ex.answer = l*b*h;
    ex.explanation = "V = l · b · h = "+l+" cm · "+b+" cm · "+h+" cm = "+(l*b*h)+" cm³.";
    return ex;
  }

  function genWuerfelVolumen(){
    var a = rand(2,9);
    var svg = boxFigureSVG(a,a,a,COLORS.koerper.main,COLORS.koerper.soft,true);
    var ex = baseEx("koerper","volumen");
    ex.question = "Berechne das Volumen dieses Würfels.";
    ex.hint = "Formel: V = a · a · a = a³. (Skizze schematisch)";
    ex.svg=svg; ex.badge="Würfel · Volumen"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm³";
    ex.answer = a*a*a;
    ex.explanation = "V = a³ = "+a+" cm · "+a+" cm · "+a+" cm = "+(a*a*a)+" cm³.";
    return ex;
  }

  function genZylinderVolumen(){
    var r = rand(2,7), h = rand(3,12);
    var svg = cylinderFigureSVG(r,h,COLORS.koerper.main,COLORS.koerper.soft);
    var ex = baseEx("koerper","volumen");
    ex.question = "Berechne das Volumen dieses Zylinders.";
    ex.hint = "Formel: V = π · r² · h. Rechne mit π ≈ 3,14. (Skizze schematisch)";
    ex.svg=svg; ex.badge="Zylinder · Volumen"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm³"; ex.tolerance=Math.max(1, r*r*h*0.02);
    ex.answer = Math.PI*r*r*h;
    ex.explanation = "V = π · r² · h ≈ 3,14 · "+r+"² · "+h+" cm³ = 3,14 · "+(r*r)+" · "+h+" cm³ = "+fmt(3.14*r*r*h)+" cm³.";
    return ex;
  }

  /* ============ Phase 3b: Oberflächenberechnung von Körpern ============ */

  function genQuaderOberflaeche(){
    var l=rand(3,10), b=rand(2,8), h=rand(2,8);
    var svg = boxFigureSVG(l,b,h,COLORS.koerper.main,COLORS.koerper.soft,false);
    var oberflaeche = 2*(l*b + b*h + l*h);
    var ex = baseEx("koerper","oberflaeche");
    ex.question = "Berechne die Oberfläche dieses Quaders (a = "+l+" cm, b = "+b+" cm, h = "+h+" cm).";
    ex.hint = "Formel: O = 2·(a·b + b·h + a·h). Ein Quader hat 6 Seitenflächen (je 2 gleich große).";
    ex.svg=svg; ex.badge="Quader · Oberfläche"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = oberflaeche;
    ex.explanation = "O = 2·("+l+"·"+b+" + "+b+"·"+h+" + "+l+"·"+h+") = 2·("+(l*b)+" + "+(b*h)+" + "+(l*h)+") = 2·"+(l*b+b*h+l*h)+" = "+fmtAT(oberflaeche)+" cm².";
    return ex;
  }

  function genWuerfelOberflaeche(){
    var a = rand(3,10);
    var svg = boxFigureSVG(a,a,a,COLORS.koerper.main,COLORS.koerper.soft,true);
    var oberflaeche = 6*a*a;
    var ex = baseEx("koerper","oberflaeche");
    ex.question = "Berechne die Oberfläche dieses Würfels (Kantenlänge a = "+a+" cm).";
    ex.hint = "Formel: O = 6·a². Ein Würfel hat 6 gleich große Quadratflächen.";
    ex.svg=svg; ex.badge="Würfel · Oberfläche"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm²";
    ex.answer = oberflaeche;
    ex.explanation = "O = 6·"+a+"² = 6·"+(a*a)+" = "+fmtAT(oberflaeche)+" cm².";
    return ex;
  }

  function genZylinderOberflaeche(){
    var r = rand(2,6), h = rand(3,10);
    var svg = cylinderFigureSVG(r,h,COLORS.koerper.main,COLORS.koerper.soft);
    var oberflaeche = 2*Math.PI*r*(r+h);
    var ex = baseEx("koerper","oberflaeche");
    ex.question = "Berechne die Oberfläche dieses Zylinders (r = "+r+" cm, h = "+h+" cm).";
    ex.hint = "Formel: O = 2·π·r·(r + h). Die Oberfläche besteht aus 2 Kreisflächen (je π·r²) und dem Mantel (2·π·r·h).";
    ex.svg=svg; ex.badge="Zylinder · Oberfläche"; ex.badgeColor=COLORS.koerper.main;
    ex.inputType="number"; ex.unit="cm²"; ex.tolerance=Math.max(1, r*(r+h)*0.05);
    ex.answer = oberflaeche;
    ex.explanation = "O = 2·π·"+r+"·("+r+" + "+h+") ≈ 2·3,14·"+r+"·"+(r+h)+" = "+fmtAT(2*3.14*r*(r+h))+" cm².";
    return ex;
  }

  /* ============ Phase 3: Brüche ============ */

  function gcd(a,b){ return b===0 ? a : gcd(b, a%b); }

  function genBruchKuerzen(diff){
    diff = diff || 2;
    var q = diff===1 ? rand(2,4) : (diff===3 ? rand(4,12) : rand(2,6)), p;
    do{ p = rand(1,q-1); } while(gcd(p,q)!==1);
    var k = diff===1 ? 2 : (diff===3 ? rand(2,5) : rand(2,4));
    var num = p*k, denom = q*k;
    var svg = fractionFigureSVG(num, denom, COLORS.bruch.main, COLORS.bruch.soft);
    var correct = p+"/"+q;
    var distractSet = [num+"/"+denom, (p+1)+"/"+q, p+"/"+(q+1)];
    var options = shuffle([correct].concat(distractSet));
    var ex = baseEx("bruch","bruch");
    ex.question = "Kürze den Bruch "+num+"/"+denom+" so weit wie möglich.";
    ex.hint = "Suche die größte Zahl, durch die Zähler und Nenner beide teilbar sind.";
    ex.svg=svg; ex.badge="Bruch · Kürzen"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
    ex.answer = correct;
    ex.explanation = num+"/"+denom+" : "+k+" = "+correct+".";
    return ex;
  }

  function genBruchAddition(){
    var d = rand(4,10);
    var n1 = rand(1,d-2), n2 = rand(1,d-n1-1);
    if(n2<1) n2=1;
    var sumNum = n1+n2;
    var svg = fractionPairFigureSVG(n1,d,n2,d,COLORS.bruch.main,COLORS.bruch.soft);
    var correct = sumNum+"/"+d;
    var distractSet = [sumNum+"/"+(2*d), (sumNum+1)+"/"+d, n1+"/"+d];
    var options = shuffle([correct].concat(distractSet));
    var ex = baseEx("bruch","bruch");
    ex.question = "Rechne: "+n1+"/"+d+" + "+n2+"/"+d+" = ?";
    ex.hint = "Bei gleichem Nenner werden nur die Zähler addiert, der Nenner bleibt gleich.";
    ex.svg=svg; ex.badge="Bruch · Addition"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
    ex.explanation = n1+"/"+d+" + "+n2+"/"+d+" = ("+n1+"+"+n2+")/"+d+" = "+correct+".";
    return ex;
  }

  function genBruchVergleich(){
    var denomsPool = [2,3,4,5,6,8,10];
    var d1,d2,n1,n2, attempts=0;
    do{
      d1 = choice(denomsPool);
      do{ d2 = choice(denomsPool); } while(d2===d1);
      n1 = rand(1,d1-1);
      n2 = rand(1,d2-1);
      attempts++;
    } while(Math.abs(n1/d1 - n2/d2) < 0.03 && attempts<50);
    if(Math.abs(n1/d1 - n2/d2) < 0.03){
      // Deterministischer Fallback für den (extrem unwahrscheinlichen) Fall,
      // dass auch nach 50 Versuchen kein klar unterscheidbares Paar gefunden wurde.
      d1=2; n1=1; d2=3; n2=1; // 1/2 vs. 1/3 - eindeutig unterschiedlich
    }
    var bigger = (n1/d1 > n2/d2) ? n1+"/"+d1 : n2+"/"+d2;
    var svg = fractionPairFigureSVG(n1,d1,n2,d2,COLORS.bruch.main,COLORS.bruch.soft);
    var options = [n1+"/"+d1, n2+"/"+d2];
    var ex = baseEx("bruch","bruch");
    ex.question = "Welcher Bruch ist größer: "+n1+"/"+d1+" oder "+n2+"/"+d2+"?";
    ex.hint = "Vergleiche die eingefärbten Anteile der beiden Balken.";
    ex.svg=svg; ex.badge="Bruch · Vergleichen"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(bigger);
    ex.explanation = bigger+" ist der größere Bruch.";
    return ex;
  }

  /* ============ Phase 3c: Brüche mit unterschiedlichen Nennern, Mal, Geteilt ============ */

  // kgV (kleinstes gemeinsames Vielfaches)
  function lcm(a,b){ return (a*b) / gcd(a,b); }

  // Addition/Subtraktion mit unterschiedlichen Nennern
  function genBruchAdditionVerschNenner(){
    var op = choice(["plus","minus"]);
    var pool = [2,3,4,5,6,8,10,12];
    var d1, d2, n1, n2;
    // Sicherstellen, dass die Nenner unterschiedlich sind
    do{ d1 = choice(pool); d2 = choice(pool); } while(d1 === d2);
    // Zähler so wählen, dass Ergebnis im Bereich (-1, 2) liegt
    n1 = rand(1, d1-1);
    n2 = rand(1, d2-1);
    if(op === "plus"){
      // Ergebnis darf nicht >= 2 sein
      if(n1/d1 + n2/d2 >= 1.9){ return genBruchAdditionVerschNenner(); }
    } else {
      // Bei Subtraktion muss n1/d1 > n2/d2 sein
      if(n1/d1 <= n2/d2){ return genBruchAdditionVerschNenner(); }
    }
    var kgV = lcm(d1, d2);
    var n1e = n1 * (kgV/d1);
    var n2e = n2 * (kgV/d2);
    var resZaehler = (op === "plus") ? (n1e + n2e) : (n1e - n2e);
    var resNenner = kgV;
    // Kürzen
    var g = gcd(resZaehler, resNenner);
    var resZk = resZaehler/g;
    var resNk = resNenner/g;
    var svg = fractionPairFigureSVG(n1,d1,n2,d2,COLORS.bruch.main,COLORS.bruch.soft);
    var ex = baseEx("bruch","bruch");
    var opSymbol = (op === "plus") ? " + " : " − ";
    var exOp = (op === "plus") ? "addieren" : "subtrahieren";
    ex.question = n1+"/"+d1+" "+opSymbol+" "+n2+"/"+d2+" = ? (Unterschiedliche Nenner!)";
    ex.hint = "1) Kleinstes gemeinsames Vielfaches (kgV) der beiden Nenner suchen: kgV("+d1+","+d2+") = "+kgV+". 2) Auf "+kgV+" erweitern: "+(n1e)+"/"+kgV+" "+opSymbol+" "+(n2e)+"/"+kgV+". 3) Zähler "+exOp+" und ggf. kürzen.";
    ex.svg=svg; ex.badge="Bruch · "+((op==="plus")?"Addition":"Subtraktion")+" (ungleiche Nenner)"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc";
    var correctAnswer = resZk+"/"+resNk;
    var pool2 = [
      (n1e+n2e+1)+"/"+kgV,
      (n1e+n2e-1)+"/"+kgV,
      correctAnswer
    ];
    if(op === "minus"){
      pool2 = [(n1e-n2e+1)+"/"+kgV, (n1e-n2e-1)+"/"+kgV, correctAnswer];
    }
    var options = shuffle(pool2.filter(function(v,i,a){return a.indexOf(v)===i;}));
    // Falls zu wenig unterschiedliche Optionen, neu generieren
    if(options.length < 2){ return genBruchAdditionVerschNenner(); }
    ex.choices=options; ex.correctIndex=options.indexOf(correctAnswer);
    ex.explanation = n1+"/"+d1+" "+opSymbol+" "+n2+"/"+d2+" = "+n1e+"/"+kgV+" "+opSymbol+" "+n2e+"/"+kgV+" = "+resZaehler+"/"+kgV+(g>1?" = "+resZk+"/"+resNk+"":"")+".";
    return ex;
  }

  // Multiplikation
  function genBruchMultiplikation(){
    var pool = [2,3,4,5,6,7,8,9,10];
    var n1 = rand(1,9), d1 = choice(pool);
    var n2 = rand(1,9), d2 = choice(pool);
    if(n1 >= d1) n1 = rand(1, d1-1);
    if(n2 >= d2) n2 = rand(1, d2-1);
    var resZaehler = n1 * n2;
    var resNenner = d1 * d2;
    var g = gcd(resZaehler, resNenner);
    var resZk = resZaehler/g;
    var resNk = resNenner/g;
    var svg = fractionPairFigureSVG(n1,d1,n2,d2,COLORS.bruch.main,COLORS.bruch.soft);
    var ex = baseEx("bruch","bruch");
    ex.question = n1+"/"+d1+" · "+n2+"/"+d2+" = ?";
    ex.hint = "Multiplikation: Zähler·Zähler und Nenner·Nenner. ("+n1+"·"+n2+") / ("+d1+"·"+d2+"). Danach ggf. kürzen.";
    ex.svg=svg; ex.badge="Bruch · Multiplikation"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc";
    var correctAnswer = resZk+"/"+resNk;
    var pool2 = [
      correctAnswer,
      (n1*n2+1)+"/"+(d1*d2),
      (n1*n2)+"/"+(d1*d2+1),
      n1+"/"+d1
    ];
    var options = shuffle(pool2.filter(function(v,i,a){return a.indexOf(v)===i;}));
    if(options.length < 2){ return genBruchMultiplikation(); }
    ex.choices=options; ex.correctIndex=options.indexOf(correctAnswer);
    ex.explanation = n1+"/"+d1+" · "+n2+"/"+d2+" = "+resZaehler+"/"+resNenner+(g>1?" = "+resZk+"/"+resNk+"":"")+".";
    return ex;
  }

  // Division
  function genBruchDivision(){
    var pool = [2,3,4,5,6,7,8,9,10];
    var n1 = rand(1,9), d1 = choice(pool);
    var n2 = rand(1,9), d2 = choice(pool);
    if(n1 >= d1) n1 = rand(1, d1-1);
    if(n2 >= d2) n2 = rand(1, d2-1);
    // Division: a/b : c/d = a·d / b·c
    var resZaehler = n1 * d2;
    var resNenner = d1 * n2;
    var g = gcd(resZaehler, resNenner);
    var resZk = resZaehler/g;
    var resNk = resNenner/g;
    var svg = fractionPairFigureSVG(n1,d1,n2,d2,COLORS.bruch.main,COLORS.bruch.soft);
    var ex = baseEx("bruch","bruch");
    ex.question = n1+"/"+d1+" : "+n2+"/"+d2+" = ?";
    ex.hint = "Division: a/b : c/d = a·d / b·c. Zuerst Kehrwert von "+n2+"/"+d2+" bilden ("+d2+"/"+n2+"), dann multiplizieren.";
    ex.svg=svg; ex.badge="Bruch · Division"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc";
    var correctAnswer = resZk+"/"+resNk;
    var pool2 = [
      correctAnswer,
      (n1*d2+1)+"/"+(d1*n2),
      (n1*d2)+"/"+(d1*n2+1),
      n1+"/"+d1
    ];
    var options = shuffle(pool2.filter(function(v,i,a){return a.indexOf(v)===i;}));
    if(options.length < 2){ return genBruchDivision(); }
    ex.choices=options; ex.correctIndex=options.indexOf(correctAnswer);
    ex.explanation = n1+"/"+d1+" : "+n2+"/"+d2+" = "+n1+"/"+d1+" · "+d2+"/"+n2+" = "+resZaehler+"/"+resNenner+(g>1?" = "+resZk+"/"+resNk+"":"")+".";
    return ex;
  }

  /* ============ Phase 3: Prozentrechnen ============ */

  function genProzentVonZahl(diff){
    diff = diff || 2;
    var p = diff===1 ? choice([10,25,50]) : (diff===3 ? choice([5,10,15,20,25,50,75]) : choice([5,10,20,25,50,75]));
    var denomReduced = 100/gcd(p,100);
    var base = denomReduced*(diff===1 ? rand(1,4) : (diff===3 ? rand(5,12) : rand(1,12)));
    var answer = p*base/100;
    var svg = percentBarSVG(p,100,COLORS.prozent.main,COLORS.prozent.soft, p+"% von "+base+" = ?");
    var ex = baseEx("prozent","prozent");
    ex.question = "Wie viel sind "+p+"% von "+base+"?";
    ex.hint = "Formel: Anteil = (Prozentsatz : 100) · Grundwert.";
    ex.svg=svg; ex.badge="Prozent · Berechnen"; ex.badgeColor=COLORS.prozent.main;
    ex.inputType="number"; ex.unit="";
    ex.answer = answer;
    ex.explanation = p+"% von "+base+" = ("+p+" : 100) · "+base+" = "+fmt(answer)+".";
    return ex;
  }

  function genProzentAnteil(){
    var total = choice([4,5,8,10,20,25,40,50]);
    var valid = [];
    for(var k=1;k<total;k++){ if((k*100)%total===0) valid.push(k); }
    var part = choice(valid);
    var percent = part*100/total;
    var svg = percentBarSVG(part,total,COLORS.prozent.main,COLORS.prozent.soft, part+" von "+total);
    var ex = baseEx("prozent","prozent");
    ex.question = part+" von "+total+" sind wie viel Prozent?";
    ex.hint = "Formel: Prozentsatz = (Anteil : Grundwert) · 100.";
    ex.svg=svg; ex.badge="Prozent · Anteil"; ex.badgeColor=COLORS.prozent.main;
    ex.inputType="number"; ex.unit="%";
    ex.answer = percent;
    ex.explanation = "("+part+" : "+total+") · 100 = "+fmt(percent)+"%.";
    return ex;
  }

  /* ============ Phase 3: Textaufgaben ============ */

  // ============ Österreich-Comic-Karte (pädagogisch) ============
  // Exakte Außengrenze aus Natural-Earth-GeoJSON (36 Punkte), echte
  // Landeshauptstädte, dezente Alpen, Bodensee und optionales Themen-Icon.
  // opts: {city:"Innsbruck", icon:"🏔️", label:"Wandern", color:"#D8495A"}
  function austriaMapSVG(opts){
    opts = opts || {};
    var main = COLORS.textaufgabe.main;
    var soft = COLORS.textaufgabe.soft;
    var s = "";
    s += _atLand(main, soft);
    s += _atCitiesAndLabels(main);
    s += _atThemes(opts, main);
    return '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">'+s+'</svg>';
  }

  // Erzeugt einen weich gerundeten geschlossenen Pfad (Quadratic-Beziers an den Ecken)
  function roundedPolyPath(pts, r){
    var n = pts.length, d = "";
    for(var i=0;i<n;i++){
      var p0=pts[(i-1+n)%n], p1=pts[i], p2=pts[(i+1)%n];
      var v1={x:p1[0]-p0[0], y:p1[1]-p0[1]}, v2={x:p2[0]-p1[0], y:p2[1]-p1[1]};
      var l1=Math.hypot(v1.x,v1.y)||1, l2=Math.hypot(v2.x,v2.y)||1;
      var rr=Math.min(r, l1/2.4, l2/2.4);
      var ax=p1[0]-v1.x/l1*rr, ay=p1[1]-v1.y/l1*rr;
      var bx=p1[0]+v2.x/l2*rr, by=p1[1]+v2.y/l2*rr;
      d += (i===0? "M "+ax.toFixed(1)+","+ay.toFixed(1) : " L "+ax.toFixed(1)+","+ay.toFixed(1));
      d += " Q "+p1[0].toFixed(1)+","+p1[1].toFixed(1)+" "+bx.toFixed(1)+","+by.toFixed(1);
    }
    return d+" Z";
  }

  // Hintergrund + gefüllte Österreich-Silhouette (gerundet)
  function _atLand(main, soft){
    var BORDER_PTS = [[282,89.7],[279.3,111.1],[259.5,111.2],[266.3,122.5],[254.6,156.2],[247.9,165.1],
      [217.1,166.4],[199.4,178.2],[170.3,174.2],[120,160.7],[112.1,142.5],[77.3,151.6],
      [73.2,161.5],[51.9,154.1],[33.9,152.6],[18,143.1],[23.4,130.3],[22,121],[32.6,118.1],
      [50.5,132.7],[55.5,118.8],[86.5,121.1],[111.7,111.7],[128.6,113.3],[139.5,124],
      [142.8,115.1],[137.8,81],[150.5,74.4],[162.9,50.2],[189,67.1],[208.8,45.7],[221.2,41.8],
      [248.6,57.7],[265.1,55],[281.3,64.9],[278.5,71.6]];
    var BORDER_D = roundedPolyPath(BORDER_PTS, 5);
    var s = '<rect width="300" height="220" fill="'+soft+'" rx="12"/>';
    // Landfläche: exakte (gerundete) Außengrenze, dezente Füllung + dicker Comic-Umriss
    s += '<path d="'+BORDER_D+'" fill="'+main+'" fill-opacity="0.13" stroke="'+main+'" stroke-width="3.2" stroke-linejoin="round"/>';
    return s;
  }

  // Landeshauptstädte (echte Positionen) mit kleinen Namen (keine Überschneidungen)
  function _atCitiesAndLabels(main){
    var CITIES = [
      {x:27.1,y:122.2,n:"Bregenz",   lx:24,   ly:131,   r:3,   a:"start"},
      {x:85.4,y:134.5,n:"Innsbruck", lx:97.5, ly:134.5, r:3,   a:"start"},
      {x:143.5,y:106.1,n:"Salzburg", lx:151.5,ly:106.1, r:3,   a:"start"},
      {x:187.2,y:80.1,n:"Linz",      lx:175,  ly:80.1,  r:3,   a:"end"},
      {x:234.4,y:85.3,n:"St. Pölten",lx:221,  ly:85.3,  r:3,   a:"end"},
      {x:260.7,y:85.3,n:"Wien",      lx:270,  ly:85.3,  r:4.5, a:"start"},
      {x:227.8,y:144.8,n:"Graz",     lx:231,  ly:156.5, r:3,   a:"start"},
      {x:187.9,y:168.1,n:"Klagenfurt",lx:187.9,ly:161,  r:3,   a:"middle"},
      {x:265.9,y:104.2,n:"Eisenstadt",lx:259,  ly:104.2, r:3,   a:"end"}
    ];
    var s = '<g>';
    for(var c=0;c<CITIES.length;c++){
      var ct = CITIES[c];
      s += '<circle cx="'+ct.x+'" cy="'+ct.y+'" r="'+(ct.r||3)+'" fill="#ffffff" stroke="'+main+'" stroke-width="2"/>';
      var isBg = (ct.n==="Bregenz"), isIbk = (ct.n==="Innsbruck");
      var tx = isBg ? ct.x+7 : ct.x;
      var ty = isBg ? ct.y+2 : (isIbk ? ct.y-5 : ct.y-7);
      var ta = isBg ? "start" : "middle";
      s += '<text x="'+tx+'" y="'+ty+'" font-family="Inter,sans-serif" font-weight="600" font-size="6.6" text-anchor="'+ta+'" fill="#444444">'+ct.n+'</text>';
    }
    s += '</g>';
    return s;
  }

  // Aufgaben-Icon groß in der Mitte Österreichs + Themen-Badge darunter
  function _atThemes(opts, main){
    var s = "";
    if(opts.icon || opts.label){
      var cx = 152, cy = 112; // Landesmitte (geografisch zentral)
      if(opts.icon){
        s += '<text x="'+cx+'" y="'+(cy+8)+'" font-size="45" text-anchor="middle">'+opts.icon+'</text>';
      }
      if(opts.label){
        var lw = opts.label.length*7 + 17;
        var pinColor = opts.color || "#D8495A";
        s += '<rect x="'+(cx-lw/2)+'" y="'+(cy+16)+'" width="'+lw+'" height="19" rx="9.5" fill="'+pinColor+'" stroke="#ffffff" stroke-width="1.5"/>';
        s += '<text x="'+cx+'" y="'+(cy+30)+'" font-size="11.5" font-weight="700" text-anchor="middle" fill="#ffffff" font-family="Fredoka,sans-serif">'+opts.label+'</text>';
      }
    } else {
      s += '<text x="150" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="'+main+'" opacity="0.55" font-family="Fredoka,sans-serif">Österreich</text>';
    }
    return s;
  }

  /* ============ Phase 4: Lineare Gleichungen ============ */

  // Gleichung ax + b = c, x ∈ ℕ (ganzzahlige positive Lösung)
  function genGleichungEinfach(diff){
    diff = diff || 2;
    var a = diff===1 ? choice([1,2,3]) : (diff===3 ? choice([2,4,6,8,10,12]) : choice([2,3,4,5]));
    var x = diff===1 ? rand(1,5) : (diff===3 ? rand(2,15) : rand(2,8));
    var b = diff===1 ? rand(1,5) : (diff===3 ? rand(1,25) : rand(1,10));
    var c = a*x + b;
    var svg = balanceSVG(a+"x + "+b, ""+c, COLORS.gleichung.main, COLORS.gleichung.soft);
    var ex = baseEx("gleichung","gleichung");
    ex.question = "Löse die Gleichung: "+a+"x + "+b+" = "+c;
    ex.hint = "1) Subtrahiere "+b+" auf beiden Seiten. 2) Teile durch "+a+".";
    ex.svg=svg; ex.badge="Gleichung · Lösen"; ex.badgeColor=COLORS.gleichung.main;
    ex.inputType="number"; ex.unit="";
    ex.answer = x;
    ex.explanation = a+"x + "+b+" = "+c+"  ⇒  "+a+"x = "+(c-b)+"  ⇒  x = "+c+" : "+a+" = "+x+".";
    return ex;
  }

  // Tabelle lesen (I3.M1): einfache Zuordnungstabelle, Wert ablesen
  function genTabelleLesen(diff){
    diff = diff || 2;
    var names = choice([["Anna","Ben","Clara","David"],["Lena","Max","Sophie","Tom"],["Emma","Felix","Mia","Paul"]]);
    var rowCount = diff===1 ? 3 : 4;
    var minVal = diff===3 ? 10 : 2, maxVal = diff===1 ? 10 : (diff===3 ? 99 : 20);
    var headers = ["Name", choice(["Punkte","Tore","Bücher","Blumen"])];
    var rows = [];
    for(var r=0;r<rowCount;r++){
      rows.push([names[r], ""+rand(minVal,maxVal)]);
    }
    var qRow = rand(0,rowCount-1);
    var answer = +rows[qRow][1];
    var svg = tableSVG(headers, rows, COLORS.gleichung.main, COLORS.gleichung.soft);
    var ex = baseEx("gleichung","tabelle");
    ex.question = "Wie viele "+headers[1]+" hat "+rows[qRow][0]+"? (Sieh in der Tabelle nach.)";
    ex.hint = "Finde die Zeile von "+rows[qRow][0]+" und lese den Wert in der Spalte „"+headers[1]+"\" ab.";
    ex.svg=svg; ex.badge="Tabelle · Lesen"; ex.badgeColor=COLORS.gleichung.main;
    ex.inputType="number"; ex.unit="";
    ex.answer = answer;
    ex.explanation = rows[qRow][0]+" hat "+answer+" "+headers[1]+" (Zeile "+(qRow+1)+", Spalte 2).";
    return ex;
  }

  // Säulendiagramm lesen (I3.M1): Balken auswerten
  function genDiagrammBalken(diff){
    diff = diff || 2;
    var labels = choice([["Apfel","Birne","Kirsche","Pflaume"],["Hund","Katze","Vogel","Fisch"],["Radi","Bus","Auto","Zug"]]);
    var n = diff===1 ? 3 : 4;
    var values = [], yMax = 0;
    for(var i=0;i<n;i++){
      var v = (diff===1 ? rand(1,6) : (diff===3 ? rand(5,20) : rand(2,10)))*5;
      values.push(v);
      if(v>yMax) yMax = v;
    }
    var qi = rand(0,n-1);
    var answer = values[qi];
    var svg = barChartSVG(labels.slice(0,n), values, COLORS.gleichung.main, yMax);
    var ex = baseEx("gleichung","diagramm");
    ex.question = "Wie viel steht über "+labels[qi]+"? (Lies den Wert im Säulendiagramm ab.)";
    ex.hint = "Finde den Balken von "+labels[qi]+" und lese den Wert an der linken Achse / über dem Balken ab.";
    ex.svg=svg; ex.badge="Diagramm · Lesen"; ex.badgeColor=COLORS.gleichung.main;
    ex.inputType="number"; ex.unit="";
    ex.answer = answer;
    ex.explanation = "Über "+labels[qi]+" steht "+answer+" (Balken "+labels[qi]+").";
    return ex;
  }


  // Gemischte Zahl in unechten Bruch umwandeln (H1.I1)
  function genGemischteZahlen(diff){
    diff = diff || 2;
    var w = diff===1 ? rand(1,2) : (diff===3 ? rand(2,6) : rand(1,4));              // ganze Zahl
    var n = diff===1 ? choice([2,3,4]) : (diff===3 ? choice([3,4,5,6,8,10]) : choice([2,3,4,5,6]));    // Nenner
    var z;
    do{ z = rand(1,n-1); } while(gcd(z,n)!==1); // echter Bruch, gekürzt
    var improperNum = w*n + z;
    var correct = improperNum+"/"+n;
    var distractSet = [improperNum+"/"+(n+1), z+"/"+n, (improperNum+w)+"/"+n];
    var options = shuffle([correct].concat(distractSet));
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<text class="dim-label" x="150" y="45" text-anchor="middle" font-size="20">'+w+' '+z+'/'+n+'</text>';
    svg += fractionBarSVG(z, n, COLORS.bruch.main, COLORS.bruch.soft, 70);
    svg += '</svg>';
    var ex = baseEx("bruch","gemischteZahlen");
    ex.question = "Wandle die gemischte Zahl "+w+" "+z+"/"+n+" in einen unechten Bruch um.";
    ex.hint = "Multipliziere die ganze Zahl mit dem Nenner und addiere den Zähler: "+w+"·"+n+" + "+z+" = "+(w*n+z)+". Der Nenner bleibt "+n+".";
    ex.svg=svg; ex.badge="Gemischte Zahl · Umwandeln"; ex.badgeColor=COLORS.bruch.main;
    ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
    ex.answer = correct;
    ex.explanation = w+" "+z+"/"+n+" = ("+w+"·"+n+" + "+z+")/"+n+" = "+improperNum+"/"+n+".";
    return ex;
  }

  // Bruch in Dezimalzahl umwandeln und umgekehrt (H1.I1)
  function genBruchDezimal(diff){
    diff = diff || 2;
    var mode = diff===1 ? "bruchZuDezimal" : choice(["bruchZuDezimal","dezimalZuBruch"]);
    var denom = diff===1 ? choice([2,4,5,10]) : (diff===3 ? choice([4,8,20,25,50]) : choice([2,4,5,8,10,20]));
    var numer;
    do{ numer = rand(1,denom-1); } while(gcd(numer,denom)!==1);
    var decimal = numer/denom;
    var svg = fractionFigureSVG(numer, denom, COLORS.bruch.main, COLORS.bruch.soft);
    var ex = baseEx("bruch","bruchDezimal");
    if(mode === "bruchZuDezimal"){
      ex.question = "Wandle den Bruch "+numer+"/"+denom+" in eine Dezimalzahl um.";
      ex.hint = "Teile den Zähler durch den Nenner (Zähler : Nenner).";
      ex.svg=svg; ex.badge="Bruch → Dezimal"; ex.badgeColor=COLORS.bruch.main;
      ex.inputType="number"; ex.unit=""; ex.tolerance=0.001;
      ex.answer = decimal;
      ex.explanation = numer+"/"+denom+" = "+numer+" : "+denom+" = "+fmt(decimal)+".";
    } else {
      ex.question = "Schreibe die Dezimalzahl "+fmt(decimal)+" als gekürzten Bruch.";
      ex.hint = "Schreibe die Dezimalzahl als Zehntel-/Hundertstelbruch und kürze dann.";
      ex.svg=svg; ex.badge="Dezimal → Bruch"; ex.badgeColor=COLORS.bruch.main;
      var distractSet = [numer+"/"+(denom*2), (numer+1)+"/"+denom, numer+"/"+(denom-1>0?denom-1:2)];
      var options = shuffle([numer+"/"+denom].concat(distractSet));
      ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(numer+"/"+denom);
      ex.answer = numer+"/"+denom;
      ex.explanation = fmt(decimal)+" = "+numer+"/"+denom+" (gekürzt).";
    }
    return ex;
  }

  // Zinsrechnung (H1.I2): Zinsen = Kapital · Zinssatz · Zeit
  function genZinsrechnung(diff){
    diff = diff || 2;
    var capital = (diff===1 ? rand(1,5) : (diff===3 ? rand(5,20) : rand(1,10)))*100;  // Kapital in € (Vielfaches von 100)
    var rate = choice([2,3,4,5,6]);   // Zinssatz in %
    var years = diff===1 ? rand(1,2) : (diff===3 ? rand(2,10) : rand(1,5));             // Zeit in Jahren
    var interest = capital*rate*years/100;   // ganzzahlig, da Kapital Vielfaches von 100
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<text class="dim-label" x="150" y="45" text-anchor="middle" font-size="17">Kapital: '+capital+' €</text>';
    svg += '<text class="dim-label" x="150" y="85" text-anchor="middle" font-size="17">Zinssatz: '+rate+' %</text>';
    svg += '<text class="dim-label" x="150" y="125" text-anchor="middle" font-size="17">Zeit: '+years+' Jahr'+(years>1?"e":"")+'</text>';
    svg += '<text class="dim-label" x="150" y="175" text-anchor="middle" font-size="18">Zinsen = ?</text>';
    svg += '</svg>';
    var ex = baseEx("prozent","zinsrechnung");
    ex.question = "Ein Sparbuch hat einen Zinssatz von "+rate+" %. Wie viel Zinsen erhält man nach "+years+" Jahr"+(years>1?"en":"")+" für "+capital+" €?";
    ex.hint = "Formel: Zinsen = Kapital · Zinssatz · Zeit: "+capital+" € · "+rate+" % · "+years+".";
    ex.svg=svg; ex.badge="Zinsrechnung · Zinsen"; ex.badgeColor=COLORS.prozent.main;
    ex.inputType="number"; ex.unit="€";
    ex.answer = interest;
    ex.explanation = "Zinsen = "+capital+" · "+rate+" % · "+years+" = "+capital+" · "+(rate/100)+" · "+years+" = "+interest+" €.";
    return ex;
  }

  // Direkte Proportionalität: Schattenlänge (H2.I2)
  function genProportionalitaet(diff){
    diff = diff || 2;
    var personH = 150;            // Person 1,50 m (in cm)
    var personS = 250;          // Schatten der Person 2,50 m (in cm)
    var treeS = 500*(diff===1 ? rand(1,2) : (diff===3 ? rand(4,8) : rand(2,5)));  // Baumschatten in cm:  ‎5–40 m
    // Saubere ganzzahlige Lösung: Verhältnis personH:personS = 150:250 = 3:5
    var treeH = personH*treeS/personS; // = 0,6·treeS → ganzzahlig,
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<line x1="20" y1="180" x2="280" y2="180" stroke="var(--ink)" stroke-width="2"/>';
    // Person
    svg += '<line x1="75" y1="180" x2="75" y2="'+(180-personH/17)+'" stroke="'+(COLORS.gleichung.main)+'" stroke-width="5" stroke-linecap="round"/>';
    svg += '<circle cx="75" cy="'+(180-personH/17-6)+'" r="5" fill="'+(COLORS.gleichung.main)+'"/>';
    svg += '<line x1="75" y1="180" x2="'+(75+personS/34)+'" y2="180" stroke="'+(COLORS.gleichung.soft)+'" stroke-width="3" stroke-dasharray="4 3"/>';
    svg += '<text class="dim-label" x="75" y="200" text-anchor="middle">1,50 m</text>';
    svg += '<text class="dim-label" x="75" y="212" text-anchor="middle">Schatten 2,50 m</text>';
    // Baum
    svg += '<line x1="220" y1="180" x2="220" y2="'+(180-treeH/17)+'" stroke="'+(COLORS.gleichung.main)+'" stroke-width="11" stroke-linecap="round"/>';
    svg += '<circle cx="220" cy="'+(180-treeH/17-7)+'" r="7" fill="'+(COLORS.gleichung.main)+'"/>';
    svg += '<line x1="220" y1="180" x2="'+(220+treeS/34)+'" y2="180" stroke="'+(COLORS.gleichung.soft)+'" stroke-width="3" stroke-dasharray="4 3"/>';
    svg += '<text class="dim-label" x="220" y="200" text-anchor="middle">Schatten '+(treeS/100)+' m</text>';
    svg += '<text class="dim-label" x="150" y="40" text-anchor="middle" font-size="16">Baumhöhe = ?</text>';
    svg += '</svg>';
    var ex = baseEx("gleichung","proportionalitaet");
    ex.question = "Ein 1,50 m großes Mädchen wirft einen 2,50 m langen Schatten. Ein Baum wirft zur gleichen Zeit einen Schatten von "+(treeS/100)+" m. Wie hoch ist der Baum?";
    ex.hint = "Gleiche Sonne ⇒ gleiches Verhältnis: Baumhöhe : Baumschatten = 1,50 :  ‎2,50. Berechne mit dem Dreisatz.";
    ex.svg=svg; ex.badge="Proportionalität · Schatten"; ex.badgeColor=COLORS.gleichung.main;
    ex.inputType="number"; ex.unit="m";
    ex.answer = treeH/100;
    ex.explanation = "Baumhöhe = "+treeS+" · 1,50 :  ‎2,50 = "+(treeS/100)+" · 0,6 = "+fmt(treeH/100)+" m.";
    return ex;
  }
// Mehrstufige Sachaufgabe (I1.M1): Klassen-Ausflug ins Freibad
  function genMehrstufig(diff){
    diff = diff || 2;
    var kids = diff===1 ? rand(5,12) : (diff===3 ? rand(20,30) : rand(15,28));          // Kinder in der Klasse
    var entry = diff===1 ? choice([1,2]) : (diff===3 ? choice([3,4,5]) : choice([2,3,4]));    // Eintritt pro Kind (€)
    var ice_cream = diff===1 ? 1 : (diff===3 ? choice([2,3]) : choice([1,2]));  // Eis pro Kind (€)
    var bus = 10*(diff===1 ? rand(1,3) : (diff===3 ? rand(3,8) : rand(3,6)));       // Buskosten
    var perKid = entry + ice_cream;   // pro Kind
    var total = kids*perKid + bus;     // Gesamtkosten
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<text class="dim-label" x="150" y="45" text-anchor="middle" font-size="18">'+kids+' Kinder</text>';
    svg += '<text class="dim-label" x="150" y="85" text-anchor="middle" font-size="16">Eintritt '+entry+' € · Eis '+ice_cream+' €</text>';
    svg += '<text class="dim-label" x="150" y="125" text-anchor="middle" font-size="16">Bus '+bus+' €</text>';
    svg += '<text class="dim-label" x="150" y="175" text-anchor="middle" font-size="18">Gesamtkosten = ?</text>';
    svg += '</svg>';
    var ex = baseEx("textaufgabe","mehrstufig");
    ex.question = "Die "+kids+" Kinder der 3. Klasse machen einen Ausflug ins Freibad. Jedes Kind zahlt "+entry+" € Eintritt und "+ice_cream+" € für ein Eis. Der Bus kostet "+bus+" €. Wie viele Euro kostet der Ausflug insgesamt?";
    ex.hint = "1) Eintritt + Eis pro Kind = "+perKid+" €. 2) Für alle Kinder: "+perKid+" · "+kids+" = "+(kids*perKid)+" €. 3) Plus Bus: +"+bus+" €.";
    ex.svg=svg; ex.badge="Sachaufgabe · Mehrstufig"; ex.badgeColor=COLORS.textaufgabe.main;

    ex.inputType="number"; ex.unit="€";
    ex.answer = total;
    ex.explanation = "("+entry+" € + "+ice_cream+" €) · "+kids+" + "+bus+" € = "+total+" €.";
    return ex;
  }
  function genTextaufgabeGarten(){
    var l = rand(5,18), b = rand(3,14);
    var maxDim=Math.max(l,b), scale=170/maxDim;
    var w=l*scale, h=b*scale, x0=(300-w)/2, y0=(220-h)/2;
    var pts=[{x:x0,y:y0},{x:x0+w,y:y0},{x:x0+w,y:y0+h},{x:x0,y:y0+h}];
    var svg = polygonSVG(pts,{color:COLORS.textaufgabe.main, soft:COLORS.textaufgabe.soft, sideLabels:[l+" m", b+" m", l+" m", b+" m"], labelOffset:16});
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = "Ein rechteckiger Garten ist "+l+" m lang und "+b+" m breit. Rund um den Garten soll ein Zaun gebaut werden. Wie viele Meter Zaun werden benötigt?";
    ex.hint = "Der Zaun läuft rundherum – gesucht ist der Umfang: U = 2 · (l + b).";
    ex.svg=svg; ex.badge="Textaufgabe · Garten"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m";
    ex.answer = 2*(l+b);
    ex.explanation = "U = 2 · (l + b) = 2 · ("+l+" m + "+b+" m) = "+(2*(l+b))+" m.";
    return ex;
  }

  function genTextaufgabePizza(){
    var n = choice([6,8,10,12]);
    var k = rand(1,n-1);
    var svg = fractionFigureSVG(k,n,COLORS.textaufgabe.main,COLORS.textaufgabe.soft);
    var percent = (k/n)*100;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = "Eine Pizza wird in "+n+" gleich große Stücke geschnitten. Anna isst "+k+" Stücke. Wie viel Prozent der Pizza hat sie gegessen?";
    ex.hint = "Zuerst als Bruch aufschreiben ("+k+"/"+n+"), dann in Prozent umrechnen (· 100).";
    ex.svg=svg; ex.badge="Textaufgabe · Pizza"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="%"; ex.tolerance=0.6;
    ex.answer = percent;
    ex.explanation = k+"/"+n+" = "+fmt(percent)+"%.";
    return ex;
  }

  /* ============ Schreibweise nach österreichischem Lehrplan ============
   * – Komma als Dezimaltrennzeichen (z. B. 3,14)
   * – Tausender-Punkt (z. B. 1.250)
   * – Euro-Schreibweise: Betrag mit " €" (z. B. 12,50 €)
   * – Mathematische Symbole: ∢ (rechter Winkel), △, □, ◯, cm², cm³
   */
  function fmtAT(x){
    // Zahl in österreichische Notation umwandeln (Komma als Dezimaltrennzeichen)
    // Entfernt trailing zeros: 1.200,00 → 1.200,  12,50 → 12,5
    var rounded = Math.round(x*100)/100;
    var s = rounded.toString();
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if(parts.length === 2){
      parts[1] = parts[1].replace(/0+$/, "");
      if(parts[1].length === 0) parts.pop();
    }
    return parts.join(",");
  }
  // Euro-Beträge: "12,50 €" (österreichische Schreibweise)
  function fmtEUR(x){
    return fmtAT(x) + " €";
  }

  /* ============ Österreich-Kontext: Personen, Orte, Produkte, Kultur ============
   * Bewusst österreichisch (z. B. "Sackerl" statt Tüte, "Schularbeit" statt Klassenarbeit,
   * "Jause" statt Pausenbrot). Eine einheitliche Sprachstimme für alle Schüler/innen in AT.
   */
  var AUSTRIA = {
    vornamen:  ["Lena","Thomas","Sophie","Jakob","Anna","Paul","Sarah","Felix","Mira","David","Emma","Elias","Nora","Matteo","Ida","Florian"],
    familien:  ["Huber","Bauer","Müller","Wagner","Gruber","Steiner","Hofer","Berger","Weber","Fuchs","Maier","Winkler","Schmid","Keller","Schwarz"],
    staedte:   ["Wien","Graz","Linz","Salzburg","Innsbruck","Klagenfurt","Villach","Wels","Sankt Pölten","Dornbirn","Steyr","Wiener Neustadt","Feldkirch","Bregenz","Leonding","Klosterneuburg"],
    sehenswuerdigkeiten:{
      "Wien":       ["Stephansdom","Schloss Schönbrunn","Belvedere","Riesenrad","Hundertwasserhaus"],
      "Salzburg":   ["Festung Hohensalzburg","Mozarts Geburtshaus","Schloss Mirabell"],
      "Innsbruck":  ["Goldenes Dachl","Schloss Ambras"],
      "Graz":       ["Schlossberg","Kunsthaus","Uhrturm","Murinsel"],
      "Linz":       ["Ars Electronica Center","Mariendom","Lentos Kunstmuseum"],
      "Klagenfurt": ["Minimundus","Lindwurmbrunnen"]
    },
    einkauf:    ["BILLA","Hofer","Spar","Lidl","Merkur","Interspar","Penny"],
    lebensmittel:["Semmel","Weckerl","Leberkäse","Mozartkugel","Sachertorte","Apfelstrudel","Kaiserschmarrn","Würstel","Breze","Kipferl","Manner-Schnitten","Milch","Butter","Topfen"],
    produkte:   ["Hauptschulheft","Lineatur-3-Heft","Bleistift","Füllfeder","Geodreieck","Zirkel","Taschenrechner","Turnbeutel","Turnpatscherl"],
    aktivitaeten:["Wandern","Schifahren","Rodeln","Schwimmen","Radfahren","Klettern","Eislaufen","Spielen am Spielplatz"],
    saisonales:{
      winter:["Punsch","Glühwein","Christkindlmarkt","Schneemann","Skikurs","Rodeln","Adventkranz"],
      fruehling:["Osterhase","Palmbuschen","Maibaum","Spargel","Krokus","Schulanfang"],
      sommer:["Grillen im Park","Donauinselfest","Badesee","Eis am Stiel","Wandertag","Sommerferien","Beeren pflücken"],
      herbst:["Erntedank","Kastanien","Wandern","Heurigen","Kürbis","Wiener Wiesn"]
    },
    schule:    ["Volksschule","Mittelschule","Gymnasium","AHS-Unterstufe","Polytechnische Schule","Berufsschule"],
    faecher:   ["Mathematik","Deutsch","Englisch","Sachunterricht","Biologie","Musikerziehung","Bewegung und Sport","Geographie"],
    noten:     ["Sehr gut","Gut","Befriedigend","Genügend","Nicht genügend"],
    schulbegriffe:{
      test:        "Schularbeit",
      hausaufgabe: "Hausübung",
      pause:       "Pause",
      jause:       "Jause",
      mappe:       "Sackerl",
      matheMappe:  "Mathe-Sackerl",
      kopfRechnen: "Kopfrechnen",
      tafel:       "Tafel",
      kreide:      "Kreide"
    }
  };

  /* ============ Phase 4: Österreichische Alltags-Sachaufgaben ============
   * Bewusst österreichische Kontexte (Wien, Wandern, Einkauf, Christkindlmarkt, Schule).
   * Notation: Komma als Dezimaltrennzeichen, " €" als Währung.
   */

  // Wien: Grundfläche eines bekannten österreichischen Bauwerks
  function genTextaufgabeWien(){
    var stadt = choice(Object.keys(AUSTRIA.sehenswuerdigkeiten));
    var bauwerk = choice(AUSTRIA.sehenswuerdigkeiten[stadt]);
    var l = rand(20, 80);
    var b = rand(10, 40);
    var flaeche = l * b;
    var maxDim=Math.max(l,b), scale=170/maxDim;
    var w=l*scale, h=b*scale, x0=(300-w)/2, y0=(220-h)/2;
    var pts=[{x:x0,y:y0},{x:x0+w,y:y0},{x:x0+w,y:y0+h},{x:x0,y:y0+h}];
    var svg = polygonSVG(pts,{color:COLORS.textaufgabe.main, soft:COLORS.textaufgabe.soft, sideLabels:[l+" m", b+" m", l+" m", b+" m"], labelOffset:16});
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = "Die Sehenswürdigkeit \""+bauwerk+"\" in "+stadt+" hat einen rechteckigen Vorplatz: "+l+" m lang und "+b+" m breit. Berechne die Fläche des Vorplatzes.";
    ex.hint = "Rechteck: A = Länge · Breite.";
    ex.svg=svg; ex.badge="Alltag · "+stadt; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m²";
    ex.answer = flaeche;
    ex.explanation = "A = "+l+" m · "+b+" m = "+fmtAT(flaeche)+" m².";
    return ex;
}

  // Wandern: Höhenmeter (sehr österreichisch!)
  function genTextaufgabeWandern(){
    var start = rand(400, 1800);
    var diff = rand(150, 900);
    var ziel = start + diff;
    var strecke = rand(2, 12);
    var ex = baseEx("textaufgabe","textaufgabe");
    var name1 = choice(AUSTRIA.vornamen);
    var name2 = choice(AUSTRIA.vornamen);
    var berg = choice(["Hochkönig","Großglockner","Dachstein","Rax","Schneeberg","Wilder Kaiser","Großer Priel"]);
    ex.question = name1+" und "+name2+" wandern in den "+berg+". Sie starten auf "+start+" m Seehöhe und erreichen das Gipfelkreuz auf "+ziel+" m Seehöhe. Sie wandern dafür "+strecke+" km. Wie viele Höhenmeter haben sie überwunden?";
    ex.hint = "Höhenmeter = Gipfelhöhe − Startshöhe. (Die Wanderstrecke in km ist hier nicht gefragt.)";
    ex.svg=austriaMapSVG({city:"Innsbruck", icon:"🥾", label:"Wandern", color:"#4A7FD6"});
    ex.badge="Alltag · Wandern"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m";
    ex.answer = diff;
    ex.explanation = "Höhenmeter = "+ziel+" m − "+start+" m = "+fmtAT(diff)+" m.";
    return ex;
  }

  // Einkauf: Preisberechnung mit Euro
  function genTextaufgabeEinkauf(){
    var laden = choice(AUSTRIA.einkauf);
    var produkt = choice(AUSTRIA.lebensmittel);
    var einzel = rand(5, 45) / 10;
    var menge = rand(2, 6);
    var summe = Math.round(einzel * menge * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    var name = choice(AUSTRIA.vornamen);
    ex.question = name+" kauft bei "+laden+" "+menge+" Stück "+produkt+" um je "+fmtEUR(einzel)+". Wie viel muss "+name+" insgesamt bezahlen?";
    ex.hint = "Gesamtpreis = Einzelpreis · Menge. Rechne sorgfältig mit dem Komma.";
    ex.svg=austriaMapSVG({city:"Linz", icon:"🛒", label:"Einkauf", color:"#E0598B"});
    ex.badge="Alltag · Einkauf"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = summe;
    ex.explanation = fmtAT(einzel)+" € · "+menge+" = "+fmtEUR(summe)+".";
    return ex;
  }

  // Christkindlmarkt: Mehrere Posten addieren + Wechselgeld
  function genTextaufgabeWeihnacht(){
    var name = choice(AUSTRIA.vornamen);
    var p1 = rand(20, 55) / 10;
    var p2 = rand(10, 35) / 10;
    var p3 = rand(8, 25) / 10;
    var n1 = rand(1, 3);
    var n2 = rand(1, 2);
    var n3 = rand(1, 2);
    var sum = Math.round((p1*n1 + p2*n2 + p3*n3) * 100) / 100;
    var gegeben = Math.ceil(sum);
    var rueckgeld = Math.round((gegeben - sum) * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" ist mit der Familie am Christkindlmarkt. "+name+" kauft "+n1+" Punsch zu je "+fmtEUR(p1)+", "+n2+" Lebkuchen zu je "+fmtEUR(p2)+" und "+n3+" Breze zu je "+fmtEUR(p3)+". "+name+" bezahlt mit einem "+fmtEUR(gegeben)+"-Schein. Wie viel Wechselgeld bekommt "+name+" zurück?";
    ex.hint = "1) Gesamtkosten berechnen (alle Posten addieren). 2) Wechselgeld = Gegeben − Gesamtkosten.";
    ex.svg=austriaMapSVG({city:"Wien", icon:"🎄", label:"Weihnacht", color:"#D8495A"});
    ex.badge="Alltag · Christkindlmarkt"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = rueckgeld;
    ex.explanation = "Gesamt: "+fmtEUR(p1*n1)+" + "+fmtEUR(p2*n2)+" + "+fmtEUR(p3*n3)+" = "+fmtEUR(sum)+". Wechselgeld: "+fmtEUR(gegeben)+" − "+fmtEUR(sum)+" = "+fmtEUR(rueckgeld)+".";
    return ex;
  }

  // Schule: Bruch-/Anteilsaufgabe aus dem Schulalltag
  function genTextaufgabeSchule(){
    var schulTyp = choice(["Mittelschule","AHS-Unterstufe","Volksschule"]);
    var klassenGroesse = choice([20, 22, 24, 25, 26, 28]);
    var nenner = choice([2, 4, 5, 8, 10]);
    var zaehler = rand(1, nenner-1);
    var anzahl = (klassenGroesse * zaehler) / nenner;
    if(anzahl !== Math.round(anzahl)) return genTextaufgabeSchule();
    var name = choice(AUSTRIA.vornamen);
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = "In einer "+klassenGroesse+"-köpfigen Klasse einer "+schulTyp+" haben "+zaehler+"/"+nenner+" aller Kinder die Mathematik-Schularbeit mit 'Sehr gut' oder 'Gut' bestanden. Wie viele Kinder sind das?";
    ex.hint = "Anzahl = Klassengröße · Bruch. Zuerst den Bruch als Dezimalzahl denken, dann mit der Klassengröße multiplizieren.";
    ex.svg=austriaMapSVG({city:"St. Pölten", icon:"🎒", label:"Schule", color:"#1FA294"});
    ex.badge="Alltag · Schule"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="";
    ex.answer = anzahl;
    ex.explanation = zaehler+"/"+nenner+" von "+klassenGroesse+" = "+klassenGroesse+" · "+zaehler+"/"+nenner+" = "+anzahl+".";
    return ex;
  }

  /* ============ Phase 4b: Kombinierte österreichische Textaufgaben ============
   * Mehrere Kompetenzbereiche in einer Aufgabe: Prozent + Addition, Bruch + Preis, etc.
   */

  // Skikurs mit Frühbucher-Rabatt
  function genTextaufgabeSkikurs(){
    var name = choice(AUSTRIA.vornamen);
    var ort = choice(["Schladming","Kitzbühel","Sölden","Mayrhofen","Zell am See","Ischgl","Saalbach"]);
    var basis = choice([120, 150, 180, 200, 240, 280]);
    var rabatt = choice([10, 15, 20, 25]);
    var rabattBetrag = basis * rabatt / 100;
    var endpreis = basis - rabattBetrag;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" bucht einen Skikurs in "+ort+". Der Kurs kostet regulär "+fmtEUR(basis)+". Bei einer Frühbucher-Aktion gibt es "+rabatt+" % Ermäßigung. Wie viel muss "+name+" bezahlen?";
    ex.hint = "1) Rabattbetrag = Grundpreis · Prozentsatz : 100. 2) Endpreis = Grundpreis − Rabattbetrag.";
    ex.svg=austriaMapSVG({city:"Innsbruck", icon:"⛷️", label:"Skikurs", color:"#7C6FE0"});
    ex.badge="Alltag · Skikurs"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = Math.round(endpreis*100)/100;
    ex.explanation = "Rabatt: "+fmtAT(basis)+" · "+rabatt+" : 100 = "+fmtEUR(rabattBetrag)+". Endpreis: "+fmtEUR(basis)+" − "+fmtEUR(rabattBetrag)+" = "+fmtEUR(endpreis)+".";
    return ex;
  }

  // Wandertag: Höhenmeter + Distanz + Zeit (gemischte Aufgabe)
  function genTextaufgabeWandertag(){
    var name = choice(AUSTRIA.vornamen);
    var name2 = choice(AUSTRIA.vornamen);
    var berg = choice(["Rax","Schneeberg","Hochkönig","Dachstein","Großer Pyhrgas"]);
    var startHoehe = rand(700, 1400);
    var zielHoehe = startHoehe + rand(300, 800);
    var hoehenmeter = zielHoehe - startHoehe;
    var distanz = rand(4, 12); // km
    var zeitStunden = rand(2, 5); // h
    var speed = Math.round((distanz / zeitStunden) * 10) / 10; // km/h
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" und "+name2+" wandern am Wandertag auf den "+berg+". Sie starten auf "+startHoehe+" m Seehöhe und erreichen den Gipfel auf "+zielHoehe+" m Seehöhe. Die Wanderstrecke ist "+distanz+" km und sie benötigen "+zeitStunden+" Stunden. a) Wie viele Höhenmeter überwinden sie? b) Welche Durchschnittsgeschwindigkeit (km/h) legen sie zurück?";
    ex.hint = "a) Höhenmeter = Gipfelhöhe − Startshöhe. b) Geschwindigkeit = Strecke : Zeit.";
    ex.svg=austriaMapSVG({city:"Graz", icon:"🏔️", label:"Wandertag", color:"#F2A93B"});
    ex.badge="Alltag · Wandertag"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m"; ex.tolerance=10;
    ex.answer = hoehenmeter;
    ex.explanation = "a) Höhenmeter = "+zielHoehe+" m − "+startHoehe+" m = "+fmtAT(hoehenmeter)+" m. b) v = "+distanz+" km : "+zeitStunden+" h = "+fmtAT(speed)+" km/h.";
    return ex;
  }

  // Schulheft: Bruchteil + Preis (kombiniert)
  function genTextaufgabeSchulheft(){
    var name = choice(AUSTRIA.vornamen);
    var produkt = choice(AUSTRIA.produkte);
    var preis = rand(20, 80) / 10; // 2,00 - 8,00 €
    var nenner = choice([2, 4, 5, 10]);
    var zaehler = rand(1, nenner-1);
    var anzahlBenoetigt = nenner; // z.B. 5 Hefte
    var anzahlGekauft = (anzahlBenoetigt * zaehler) / nenner;
    if(anzahlGekauft !== Math.round(anzahlGekauft)) return genTextaufgabeSchulheft();
    var anzahlBezahlt = anzahlBenoetigt - anzahlGekauft; // geschenkt bekommen
    var gesamtKosten = Math.round(anzahlGekauft * preis * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" braucht "+anzahlBenoetigt+" "+produkt+" für die Schule. Im Geschäft gilt diese Woche: Wer "+anzahlBenoetigt+" Stück kauft, zahlt nur für "+zaehler+" Stück. Ein "+produkt+" kostet "+fmtEUR(preis)+". Wie viel muss "+name+" bezahlen?";
    ex.hint = "1) Bezahlte Stück: "+zaehler+" (die restlichen "+anzahlBezahlt+" sind gratis dazu). 2) Gesamtpreis = bezahlte Stück · Einzelpreis.";
    ex.svg=austriaMapSVG({city:"St. Pölten", icon:"📚", label:"Schulstart", color:"#9C4F96"});
    ex.badge="Alltag · Schulstart"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = gesamtKosten;
    ex.explanation = name+" bekommt "+anzahlBenoetigt+" Stück und zahlt nur für "+zaehler+" Stück ("+anzahlBezahlt+" gratis dazu). Gesamtpreis: "+zaehler+" · "+fmtAT(preis)+" € = "+fmtEUR(gesamtKosten)+".";
    return ex;
  }

  // Eisdiele: Bruch, Prozent, Addition
  function genTextaufgabeEiscafe(){
    var name = choice(AUSTRIA.vornamen);
    var kugelPreis = rand(15, 30) / 10; // 1,50 - 3,00 €
    var anzahlKugeln = rand(2, 4);
    var preisEis = Math.round(anzahlKugeln * kugelPreis * 100) / 100;
    var portionen = [3, 4, 5];
    var nenner = choice(portionen);
    var zaehler = rand(1, nenner-1);
    var rabatt = Math.round((preisEis * zaehler / nenner) * 100) / 100; // zaehler/nenner gratis
    var endpreis = Math.round((preisEis - rabatt) * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" geht in die Eisdiele und bestellt "+anzahlKugeln+" Kugeln Eis um je "+fmtEUR(kugelPreis)+". Die Eisdiele hat eine Aktion: "+zaehler+"/"+nenner+" des Preises werden als Rabatt abgezogen. Wie viel bezahlt "+name+"?";
    ex.hint = "1) Gesamtpreis = Anzahl · Kugelpreis. 2) Rabatt = Gesamtpreis · "+zaehler+"/"+nenner+". 3) Endpreis = Gesamtpreis − Rabatt.";
    ex.svg=austriaMapSVG({city:"Graz", icon:"🍦", label:"Eisdiele", color:"#E0598B"});
    ex.badge="Alltag · Eisdiele"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = endpreis;
    ex.explanation = "Gesamtpreis: "+anzahlKugeln+" · "+fmtAT(kugelPreis)+" € = "+fmtEUR(preisEis)+". Rabatt: "+fmtEUR(preisEis)+" · "+zaehler+"/"+nenner+" = "+fmtEUR(rabatt)+". Endpreis: "+fmtEUR(preisEis)+" − "+fmtEUR(rabatt)+" = "+fmtEUR(endpreis)+".";
    return ex;
  }

  /* ============ Pools & Modes ============ */
  // Hilfsfunktion: setzt _currentCurriculumKey und ruft den Generator auf
  function withCurriculum(key, fn){
    return function(diff){
      _currentCurriculumKey = key;
      return fn(diff === undefined ? 2 : diff);
    };
  }

  var GEN = {
    dreieckWinkel:        withCurriculum("dreieckWinkel",         genDreieckWinkel),
    viereckWinkel:        withCurriculum("viereckWinkel",         genViereckWinkel),
    dreieckUmfang:        withCurriculum("dreieckUmfang",         genDreieckUmfang),
    viereckUmfang:        withCurriculum("viereckUmfang",         genViereckUmfang),
    dreieckFlaeche:       withCurriculum("dreieckFlaeche",        genDreieckFlaeche),
    rechteckFlaeche:      withCurriculum("rechteckFlaeche",       genRechteckFlaeche),
    parallelogrammFlaeche:withCurriculum("parallelogrammFlaeche", genParallelogrammFlaeche),
    trapezFlaeche:        withCurriculum("trapezFlaeche",         genTrapezFlaeche),
    dreieckErkennen:      withCurriculum("dreieckErkennen",       genDreieckErkennen),
    viereckErkennen:      withCurriculum("viereckErkennen",       genViereckErkennen),
    eigenschaftenDreieck: withCurriculum("eigenschaftenDreieck",  genEigenschaftenDreieck),
    eigenschaftenViereck: withCurriculum("eigenschaftenViereck",  genEigenschaftenViereck),
    kreisUmfang:          withCurriculum("kreisUmfang",           genKreisUmfang),
    kreisFlaeche:         withCurriculum("kreisFlaeche",          genKreisFlaeche),
    quaderVolumen:        withCurriculum("quaderVolumen",         genQuaderVolumen),
    wuerfelVolumen:       withCurriculum("wuerfelVolumen",        genWuerfelVolumen),
    zylinderVolumen:      withCurriculum("zylinderVolumen",       genZylinderVolumen),
    quaderOberflaeche:    withCurriculum("quaderOberflaeche",     genQuaderOberflaeche),
    wuerfelOberflaeche:   withCurriculum("wuerfelOberflaeche",    genWuerfelOberflaeche),
    zylinderOberflaeche:  withCurriculum("zylinderOberflaeche",   genZylinderOberflaeche),
    bruchKuerzen:             withCurriculum("bruchKuerzen",              genBruchKuerzen),
    bruchAddition:            withCurriculum("bruchAddition",             genBruchAddition),
    bruchAdditionVerschNenner:withCurriculum("bruchAdditionVerschNenner", genBruchAdditionVerschNenner),
    bruchVergleich:           withCurriculum("bruchVergleich",            genBruchVergleich),
    bruchMultiplikation:      withCurriculum("bruchMultiplikation",      genBruchMultiplikation),
    bruchDivision:            withCurriculum("bruchDivision",            genBruchDivision),
    prozentVonZahl:       withCurriculum("prozentVonZahl",        genProzentVonZahl),
    prozentAnteil:        withCurriculum("prozentAnteil",         genProzentAnteil),
    textaufgabeGarten:    withCurriculum("textaufgabeGarten",     genTextaufgabeGarten),
    textaufgabePizza:     withCurriculum("textaufgabePizza",      genTextaufgabePizza),
    textaufgabeWien:      withCurriculum("textaufgabeWien",       genTextaufgabeWien),
    textaufgabeWandern:   withCurriculum("textaufgabeWandern",    genTextaufgabeWandern),
    textaufgabeEinkauf:   withCurriculum("textaufgabeEinkauf",    genTextaufgabeEinkauf),
    textaufgabeWeihnacht: withCurriculum("textaufgabeWeihnacht",  genTextaufgabeWeihnacht),
    textaufgabeSchule:    withCurriculum("textaufgabeSchule",     genTextaufgabeSchule),
    textaufgabeSkikurs:   withCurriculum("textaufgabeSkikurs",    genTextaufgabeSkikurs),
    textaufgabeWandertag: withCurriculum("textaufgabeWandertag",  genTextaufgabeWandertag),
    textaufgabeSchulheft: withCurriculum("textaufgabeSchulheft",  genTextaufgabeSchulheft),
    textaufgabeEiscafe:   withCurriculum("textaufgabeEiscafe",    genTextaufgabeEiscafe),
    gleichungEinfach:     withCurriculum("gleichungEinfach",      genGleichungEinfach),
    tabelleLesen:        withCurriculum("tabelleLesen",         genTabelleLesen),
    diagrammBalken:      withCurriculum("diagrammBalken",        genDiagrammBalken),
    gemischteZahlen:     withCurriculum("gemischteZahlen",       genGemischteZahlen),
    bruchDezimal:        withCurriculum("bruchDezimal",          genBruchDezimal),
    zinsrechnung:        withCurriculum("zinsrechnung",          genZinsrechnung),
    proportionalitaet:   withCurriculum("proportionalitaet",     genProportionalitaet),
    mehrstufig:          withCurriculum("mehrstufig",            genMehrstufig)
  };

  var MODES = [
    {id:"alles", label:"🎲 Alles gemischt", pool:Object.keys(GEN)},
    {id:"dreieck", label:"🔺 Dreiecke", pool:["dreieckWinkel","dreieckUmfang","dreieckFlaeche","dreieckErkennen","eigenschaftenDreieck"]},
    {id:"viereck", label:"◻ Vierecke", pool:["viereckWinkel","viereckUmfang","rechteckFlaeche","parallelogrammFlaeche","trapezFlaeche","viereckErkennen","eigenschaftenViereck"]},
    {id:"winkel", label:"📐 Winkel", pool:["dreieckWinkel","viereckWinkel"]},
    {id:"umfang-flaeche", label:"📏 Umfang & Fläche", pool:["dreieckUmfang","viereckUmfang","dreieckFlaeche","rechteckFlaeche","parallelogrammFlaeche","trapezFlaeche"]},
    {id:"kreis", label:"⭕ Kreis", pool:["kreisUmfang","kreisFlaeche"]},
    {id:"koerper", label:"📦 Körper (Volumen)", pool:["quaderVolumen","wuerfelVolumen","zylinderVolumen"]},
    {id:"oberflaeche", label:"📊 Oberfläche von Körpern", pool:["quaderOberflaeche","wuerfelOberflaeche","zylinderOberflaeche"]},
    {id:"bruche", label:"➗ Brüche (alle Operationen)", pool:["bruchKuerzen","bruchAddition","bruchAdditionVerschNenner","bruchVergleich","bruchMultiplikation","bruchDivision"]},
    {id:"bruch-prozent", label:"➗ Brüche & Prozent", pool:["bruchKuerzen","bruchAddition","bruchAdditionVerschNenner","bruchVergleich","bruchMultiplikation","bruchDivision","prozentVonZahl","prozentAnteil"]},
    {id:"textaufgaben", label:"📖 Textaufgaben", pool:["textaufgabeGarten","textaufgabePizza","textaufgabeSchulheft","textaufgabeEiscafe","textaufgabeSkikurs","textaufgabeWandertag"]},
    {id:"alltag", label:"🇦🇹 Alltag in Österreich", pool:["textaufgabeWien","textaufgabeWandern","textaufgabeEinkauf","textaufgabeWeihnacht","textaufgabeSchule","textaufgabeSchulheft","textaufgabeEiscafe","textaufgabeSkikurs","textaufgabeWandertag"]},
    {id:"gleichungen", label:"⚖️ Gleichungen & Tabellen", pool:["gleichungEinfach","tabelleLesen"]},
    {id:"weiteres", label:"🔢 Weiteres Rechnen", pool:["diagrammBalken","gemischteZahlen","bruchDezimal","zinsrechnung","proportionalitaet","mehrstufig"]}
  ];

  /* Schulstufen-Zuordnung je Übungstyp (1.–4. Klasse Mittelschule) */
  var GRADE_TAGS = {
    dreieckWinkel:[2,3], viereckWinkel:[2,3], dreieckUmfang:[2,3], viereckUmfang:[2,3],
    dreieckFlaeche:[2,3], rechteckFlaeche:[2,3], parallelogrammFlaeche:[3], trapezFlaeche:[3],
    dreieckErkennen:[2,3], viereckErkennen:[2,3], eigenschaftenDreieck:[2,3], eigenschaftenViereck:[2,3],
    kreisUmfang:[3,4], kreisFlaeche:[3,4],
    quaderVolumen:[2,3], wuerfelVolumen:[2,3], zylinderVolumen:[4],
    quaderOberflaeche:[3,4], wuerfelOberflaeche:[2,3], zylinderOberflaeche:[4],
    bruchKuerzen:[1,2], bruchAddition:[1,2], bruchVergleich:[1,2],
    bruchAdditionVerschNenner:[2,3], bruchMultiplikation:[3,4], bruchDivision:[4],
    prozentVonZahl:[3,4], prozentAnteil:[3,4],
    textaufgabeGarten:[2,3], textaufgabePizza:[2,3],
    textaufgabeWien:[2,3], textaufgabeWandern:[2,3], textaufgabeEinkauf:[2,3],
    textaufgabeWeihnacht:[2,3], textaufgabeSchule:[2,3],
    textaufgabeSkikurs:[3,4], textaufgabeWandertag:[2,3], textaufgabeSchulheft:[2,3], textaufgabeEiscafe:[2,3],
    gleichungEinfach:[3,4],
    tabelleLesen:[2,3],
    diagrammBalken:[2,3], gemischteZahlen:[1,2], bruchDezimal:[1,2],
    zinsrechnung:[3,4], proportionalitaet:[2,3], mehrstufig:[2,3]
  };
  var GRADE_GROUPS = { "12":[1,2], "34":[3,4] };
  var GRADES = [
    {id:"all", label:"Alle Schulstufen"},
    {id:"12", label:"1./2. Klasse"},
    {id:"34", label:"3./4. Klasse"}
  ];
  /* Schwierigkeitsstufen (P2.1): 1=Einstieg, 2=Training (Standard), 3=Anforderung.
   * Generatoren erhalten diff als Parameter; ohne Migration gilt weiterhin Stufe 2. */
  var DIFFICULTIES = [
    {id:1, label:"🌱 Einstieg"},
    {id:2, label:"🎯 Training"},
    {id:3, label:"🚀 Anforderung"}
  ];

  /* ============ Österreichischer Lehrplan: Bildungsstandards & Kompetenzbereiche ============
   * Quellen-Grundlage: BMBWF Lehrplan 2023 (Mathematik, AHS-Unterstufe / Mittelschule)
   * sowie "Komp[e]tenzorientierter Unterricht" – Kompetenzbereiche H1–H4, I1–I3
   * Codierung: <Schulstufe>.<Kompetenzbereich>-<Laufnummer>
   *  – Kompetenzbereiche: H1 Zahlen & Maße, H2 Variable & Funktionen, H3 Figuren & Körper, H4 Statistik
   *  – I1 Modellieren, I2 Operieren, I3 Interpretieren
   */
  var LEHRPLAN = {
    "H3.I1":  "Figuren und Körper in der Umwelt erkennen und beschreiben",
    "H3.I2":  "Eigenschaften von Dreiecken, Vierecken und Kreisen benennen und anwenden",
    "H3.I3":  "Umfang und Flächeninhalt ebener Figuren berechnen",
    "H3.I4":  "Volumen und Oberfläche von Körpern berechnen",
    "H3.I5":  "Winkelbeziehungen und Winkelsummen nutzen",
    "H1.I1":  "Mit Brüchen rechnen und diese in Alltagskontexten anwenden",
    "H1.I2":  "Prozentbegriff verstehen und Prozentrechnungen durchführen",
    "H1.I3":  "Größen in unterschiedlichen Maßeinheiten darstellen und umrechnen",
    "H2.I1":  "Mit Variablen arbeiten und lineare Gleichungen lösen",
    "H2.I2":  "Proportionale Zusammenhänge erkennen und anwenden",
    "I1.M1":  "Sachverhalte aus dem Alltag in mathematische Modelle übersetzen",
    "I2.M1":  "Mathematische Verfahren sicher und sinnvoll anwenden",
    "I3.M1":  "Ergebnisse interpretieren, prüfen und in Alltagssprache erklären"
  };
  // Curriculum-Mapping pro Übungstyp (Codes verweisen auf LEHRPLAN)
  var CURRICULUM_MAP = {
    dreieckWinkel:        {codes:["H3.I5","H3.I1"], kompetenz:"Winkelsumme im Dreieck anwenden"},
    viereckWinkel:        {codes:["H3.I5","H3.I1"], kompetenz:"Winkelsumme im Viereck anwenden"},
    dreieckUmfang:        {codes:["H3.I3","I2.M1"], kompetenz:"Umfang eines Dreiecks berechnen"},
    viereckUmfang:        {codes:["H3.I3","I2.M1"], kompetenz:"Umfang eines Vierecks berechnen"},
    dreieckFlaeche:       {codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Dreiecks berechnen"},
    rechteckFlaeche:      {codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Rechtecks berechnen"},
    parallelogrammFlaeche:{codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Parallelogramms berechnen"},
    trapezFlaeche:        {codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Trapezes berechnen"},
    dreieckErkennen:      {codes:["H3.I1","H3.I2"], kompetenz:"Dreiecksarten unterscheiden"},
    viereckErkennen:      {codes:["H3.I1","H3.I2"], kompetenz:"Vierecksarten unterscheiden"},
    eigenschaftenDreieck: {codes:["H3.I2","I3.M1"], kompetenz:"Eigenschaften von Dreiecken begründet angeben"},
    eigenschaftenViereck: {codes:["H3.I2","I3.M1"], kompetenz:"Eigenschaften von Vierecken begründet angeben"},
    kreisUmfang:          {codes:["H3.I3","I2.M1"], kompetenz:"Umfang eines Kreises berechnen (U = 2·π·r)"},
    kreisFlaeche:         {codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Kreises berechnen (A = π·r²)"},
    quaderVolumen:        {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Quaders berechnen"},
    wuerfelVolumen:       {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Würfels berechnen"},
    zylinderVolumen:      {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Zylinders berechnen"},
    quaderOberflaeche:    {codes:["H3.I4","I2.M1"], kompetenz:"Oberfläche eines Quaders berechnen (O = 2·(a·b + b·c + a·c))"},
    wuerfelOberflaeche:   {codes:["H3.I4","I2.M1"], kompetenz:"Oberfläche eines Würfels berechnen (O = 6·a²)"},
    zylinderOberflaeche:  {codes:["H3.I4","I2.M1"], kompetenz:"Oberfläche eines Zylinders berechnen (O = 2·π·r·(r+h))"},
    bruchKuerzen:         {codes:["H1.I1","I2.M1"], kompetenz:"Brüche kürzen und erweitern"},
    bruchAddition:        {codes:["H1.I1","I2.M1"], kompetenz:"Brüche addieren und subtrahieren"},
    bruchVergleich:       {codes:["H1.I1","I3.M1"], kompetenz:"Brüche vergleichen und ordnen"},
    bruchAdditionVerschNenner:{codes:["H1.I1","I2.M1"], kompetenz:"Brüche mit unterschiedlichen Nennern addieren und subtrahieren (Hauptnenner)"},
    bruchMultiplikation:  {codes:["H1.I1","I2.M1"], kompetenz:"Brüche multiplizieren (Zähler·Zähler, Nenner·Nenner)"},
    bruchDivision:        {codes:["H1.I1","I2.M1"], kompetenz:"Brüche dividieren (mit dem Kehrwert des Divisors multiplizieren)"},
    prozentVonZahl:       {codes:["H1.I2","I1.M1"], kompetenz:"Prozentwert berechnen (Alltagskontext)"},
    prozentAnteil:        {codes:["H1.I2","I1.M1"], kompetenz:"Prozentanteile in Sachsituationen bestimmen"},
    textaufgabeGarten:    {codes:["I1.M1","I3.M1","H1.I3"], kompetenz:"Sachaufgabe mit Längen/Flächen modellieren und lösen"},
    textaufgabePizza:     {codes:["I1.M1","H1.I1","H1.I2"], kompetenz:"Bruch- und Prozentaufgabe aus dem Alltag lösen"},
    textaufgabeWien:      {codes:["I1.M1","H1.I3","I3.M1"], kompetenz:"Sachaufgabe mit österreichischem Alltagsbezug modellieren und lösen"},
    textaufgabeWandern:   {codes:["I1.M1","H1.I3","I3.M1"], kompetenz:"Sachaufgabe mit Längen und Höhenmetern aus dem Alltag lösen"},
    textaufgabeEinkauf:   {codes:["I1.M1","H1.I2","I3.M1"], kompetenz:"Preisberechnung und Prozentrechnung im Alltag"},
    textaufgabeWeihnacht: {codes:["I1.M1","H1.I2","I3.M1"], kompetenz:"Sachaufgabe mit Preisen und Mengen aus dem Alltag lösen"},
    textaufgabeSchule:    {codes:["I1.M1","H1.I1","I3.M1"], kompetenz:"Bruch- und Anteilsaufgabe aus dem Schulalltag"},
    textaufgabeSkikurs:   {codes:["I1.M1","H1.I2","I2.M1"], kompetenz:"Prozentrechnung (Rabatt) und Preisberechnung kombinieren"},
    textaufgabeWandertag: {codes:["I1.M1","H1.I3","I3.M1"], kompetenz:"Längen, Höhenmeter und Zeiträume aus dem Wandern modellieren"},
    textaufgabeSchulheft: {codes:["I1.M1","H1.I1","H1.I2","I2.M1"], kompetenz:"Bruch- und Preisberechnung im Schulalltag kombinieren"},
    textaufgabeEiscafe:   {codes:["I1.M1","H1.I1","H1.I2","I3.M1"], kompetenz:"Brüche, Prozente und Beträge im Alltag kombinieren"},
    gleichungEinfach:     {codes:["H2.I1"], kompetenz:"Lineare Gleichung der Form ax + b = c lösen"},
    tabelleLesen:        {codes:["I3.M1"], kompetenz:"Datentabelle lesen und Werte ablesen"},
    diagrammBalken:      {codes:["I3.M1"], kompetenz:"Säulendiagramm lesen und Werte ablesen"},
    gemischteZahlen:     {codes:["H1.I1"], kompetenz:"Gemischte Zahlen in unechte Brüche umwandeln und umgekehrt"},
    bruchDezimal:        {codes:["H1.I1"], kompetenz:"Brüche in Dezimalzahlen umwandeln und umgekehrt"},
    zinsrechnung:        {codes:["H1.I2"], kompetenz:"Zinsen mit der Zinsformel (Z = K · p · t) berechnen"},
    proportionalitaet:   {codes:["H2.I2"], kompetenz:"Direkt proportionale Zusammenhänge (z. B. Schattenlängen) anwenden"},
    mehrstufig:          {codes:["I1.M1","I2.M1"], kompetenz:"Mehrstufige Sachaufgaben in Teilschritten lösen"}
  };

  window.MB = {
    rand, randf, choice, shuffle, dist, mid, centroidOf, gcd, lcm, fmt, fmtAT, fmtEUR,
    normalizeAndScale, edgeLabelPos, vertexLabelPos, tickMarks, rightAngleMarker,
    polygonSVG, circleFigureSVG, boxFigureSVG, cylinderFigureSVG,
    fractionBarSVG, fractionFigureSVG, fractionPairFigureSVG, percentBarSVG,
    renderFigure, updateCurriculumBadge, openCurriculumModal, closeCurriculumModal,
    triangleFromSides, isValidTriangle, parallelogramFromSides, baseEx,
    COLORS, AUSTRIA, TRI_TEMPLATES, QUAD_TEMPLATES, QUAD_NAMES,
    TRI_STATEMENTS, QUAD_STATEMENTS, CURRICULUM_MAP, GEN, MODES, GRADES,
    GRADE_GROUPS, GRADE_TAGS, DIFFICULTIES
  };
})();
