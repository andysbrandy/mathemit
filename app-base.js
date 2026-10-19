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
    gleichung: {main:"var(--gleichung)", soft:"var(--gleichung-soft)"},
    zahl: {main:"var(--zahl)", soft:"var(--zahl-soft)"}
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
        var off = opts.labelOffset||17;
        /* Vertikale/nahezu vertikale Kanten: Label ist horizontal zentriert und
           würde die Maßstriche (ticks) überdecken -> Extra-Abstand ausserhalb */
        var ex_ = b.x-a.x, ey_ = b.y-a.y;
        var el_ = Math.hypot(ex_,ey_) || 1;
        var vert_ = Math.abs(ex_)/el_;   /* 0 = exakt vertikal */
        if(vert_ < 0.35){
          var tickN = (opts.ticks && opts.ticks[i]) ? opts.ticks[i] : 0;
          off += tickN * 4 + String(lbl).length * 3;
        }
        var pos = edgeLabelPos(a,b,centroid, off);
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
    return {category:category, topic:topic, curriculumKey:_currentCurriculumKey, tips:[]};
  }

  /* ============ P3: Tipp-System (progressiv) ============ */
  /* Tipp 1 „Andeuten" je Topic – deckt alle Generatoren ab, ohne 48x Content zu pflegen.
   * Generatoren können ex.tips=[...] setzen und überschreiben damit die Ableitung. */
  var TIPP1_BY_TOPIC = {
    winkel:"Denk an die Winkelsumme: Dreieck 180°, Viereck 360°.",
    umfang:"Umfang = Summe aller Seiten. Welche Seiten sind gleich lang?",
    flaeche:"Welche Fläche ist es? Jede Form hat ihre Formel (Grundseite × Höhe ÷ …).",
    erkennen:"Achte auf Markierungen (Gleichen-Striche) und rechte Winkel (kleines Quadrat).",
    eigenschaften:"Prüfe die Aussage an einer kleinen Skizze.",
    volumen:"Volumen = Grundfläche × Höhe. Welcher Körper ist es?",
    oberflaeche:"Oberfläche = alle Außenflächen zusammen (Stelle dir das Netz vor).",
    bruch:"Gleiche Nenner? Sonst Hauptnenner suchen. Bei ×: Zähler×Zähler, Nenner×Nenner.",
    prozent:"Prozent heißt „von Hundert“: Grundwert × (p : 100).",
    textaufgabe:"Unterstreiche Zahlen und Frage. Welcher Rechenweg führt zur Antwort?",
    gleichung:"Bringe x allein auf eine Seite – umgekehrte Operationen auf beiden Seiten.",
    gleichungssystem:"Zwei Gleichungen, ein Paar (x, y): Einsetzverfahren (y = … einsetzen) oder Additionsverfahren (eine Variable weg-addieren). Probe in beiden!",
    pythagoras:"Rechter Winkel? Dann a² + b² = c². Die Hypotenuse c liegt gegenüber dem rechten Winkel und ist die längste Seite.",
    tabelle:"Suche die richtige Zeile und Spalte – lies genau ab.",
    diagramm:"Finde den Balken und lese an der Achse bzw. über dem Balken ab.",
    gemischteZahlen:"Ganze Zahl × Nenner + Zähler = neuer Zähler. Der Nenner bleibt.",
    bruchDezimal:"Zähler : Nenner = Dezimalzahl (mit Komma weiterrechnen).",
    zinsrechnung:"Z = K · p · t – setze Kapital, Zinssatz und Zeit ein.",
    proportionalitaet:"Gleiche Sonne ⇒ gleiches Verhältnis. Stelle den Dreisatz auf.",
    indirekteProportionalitaet:"Indirekt heißt: mehr Leute, weniger Zeit (umgekehrt!). Rechne zuerst die Gesamtarbeit aus (Leute · Zeit), dann teile auf.",
    mehrstufig:"Teile auf in Schritte: 1) pro Kind 2) alle zusammen 3) Extras.",
    ganzeZahlen:"Auf dem Zahlenstrahl liegt die kleinere Zahl weiter links. Bei + und −: gleiche Vorzeichen addieren die Beträge, verschiedene ziehen ab (Vorzeichen des größeren Betrags gewinnt).",
    wahrscheinlichkeit:"Günstige Fälle durch mögliche Fälle: zähle zuerst, wie viele Fälle gewinnen, dann teile durch alle Fälle.",
    mittelwerte:"Mittelwert = Summe aller Werte : Anzahl. Modus = der Wert, der am häufigsten vorkommt. Median = der mittlere Wert, nachdem du alles der Größe nach sortiert hast.",
    einheiten:"Größere in kleinere Einheit: mal dem Faktor (Komma nach rechts). Kleinere in größere: durch den Faktor (Komma nach links). Länge und Masse in 10er-Schritten, Geld 1 € = 100 ct.",
    potenzen:"a hoch n = a · a · … · a (n Faktoren). Wurzel fragt: welche Zahl malgenommen mit sich selbst ergibt a? Zehnerpotenz: Exponent = Anzahl Nullen. Minus im Exponent heißt Kehrwert (1 : …).",
    potenzenErweitert:"Zehnerpotenz: Exponent = Anzahl der Nullen nach der 1. Gleitkomma: Komma um n Stellen nach rechts schieben. Minus im Exponent ⇒ Kehrwert 1 : (a hoch n).",
    teilbarkeit:"Teilung mit Rest: „Was bleibt übrig, wenn du in Gruppen aufteilst?“. Primzahl: nur durch 1 und sich selbst teilbar (gerade Zahlen außer 2 nie, endet auf 5/0 nie außer 5). kgV: kleinste Zahl, die in beide Zahlenstrahlen passt. ggT: größte Zahl, die beide ohne Rest teilt.",
    terme:"Klammern auflösen: den Faktor vor der Klammer mit jedem Term in der Klammer multiplizieren. Gleiche Terme (mit x) zusammenfassen.",
    binom:"Plus-Formel: (a + b)² = a² + 2ab + b². Minus-Formel: (a − b)² = a² − 2ab + b². Plus-Minus: (a + b)(a − b) = a² − b².",
    lineareFunktionen:"Steigung m = Anstieg : Lauf (wie steil geht die Gerade hoch/runter?). y-Achsenabschnitt t: Wo schneidet die Gerade die y-Achse (x = 0)? y = m·x + t",
    kongruenz:"Kongruent = gleiche Seiten & gleiche Winkel (deckungsgleich). Ähnlich = gleiche Winkel, Seiten proportional. Merke: SSW (2 Seiten + ein Winkel) bestimmt ein Dreieck nicht eindeutig.",
    aehnlichkeit:"Ähnliche Dreiecke haben die gleichen Winkel; die Seiten stehen im gleichen Verhältnis (Streckfaktor). Nicht verwechseln mit kongruent (dort sind auch die Seiten gleich lang).",
    kongruenzsatz:"SSS = alle 3 Seiten gleich · SWS = 2 Seiten + eingeschlossener Winkel · WSW = 2 Winkel + eingeschlossene Seite · SSW ist nicht eindeutig.",
    _default:"Lies die Aufgabe noch einmal langsam – welche Zahlen und welche Frage gibt es?"
  };
  function deriveTips(ex){
    if(ex.tips && ex.tips.length>0) return ex.tips;
    var tips = [];
    var t1 = TIPP1_BY_TOPIC[ex.topic] || TIPP1_BY_TOPIC[ex.category] || TIPP1_BY_TOPIC._default;
    tips.push(t1);
    if(ex.hint && ex.hint!==t1) tips.push(ex.hint); // Tipp 2: Formel/Ansatz
    return tips;
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
  function genDreieckWinkel(diff){
    diff = diff || 2;
    var a,b,c;
    do{
      a = diff===1?rand(35,90):(diff===3?rand(15,135):rand(25,120));
      b = diff===1?rand(35,90):(diff===3?rand(15,135):rand(25,120));
      c = 180-a-b;
    } while(c<(diff===1?30:20) || c>(diff===1?110:130));
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
  function genViereckWinkel(diff){
    diff = diff || 2;
    var vals = null, pts = null;
    for(var tries=0; tries<500 && !pts; tries++){
      var lo=diff===1?60:(diff===3?30:50), hi=diff===1?120:(diff===3?160:140);
      var a=rand(lo,hi), b=rand(lo,hi), c=rand(lo,hi), d=360-a-b-c;
      if(d<(diff===1?60:40) || d>(diff===1?120:150)) continue;
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
  function genDreieckUmfang(diff){
    diff = diff || 2;
    var a,b,c;
    do{
      a=(diff===1?rand(3,8):(diff===3?rand(5,20):rand(4,12))); b=(diff===1?rand(3,8):(diff===3?rand(5,20):rand(4,12))); c=(diff===1?rand(3,8):(diff===3?rand(5,20):rand(4,12)));
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
  function genViereckUmfang(diff){
    diff = diff || 2;
    var isSquare = Math.random()<0.4;
    var lo=diff===1?2:(diff===3?4:3), hi=diff===1?7:(diff===3?25:12);
    var a = rand(lo,hi), b = isSquare? a : rand(lo,hi);
    while(!isSquare && b===a){ b = rand(lo,hi); }
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
  function genDreieckFlaeche(diff){
    diff = diff || 2;
    var g = diff===1?rand(3,8):(diff===3?rand(6,25):rand(4,14)), h = diff===1?rand(2,6):(diff===3?rand(4,20):rand(3,12));
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

  // Satz des Pythagoras (H3): rechtwinkliges Dreieck, eine Seite gesucht.
  // Bewusst pythagoreische Zahlentripel (3-4-5, 6-8-10, 5-12-13, ...), damit die
  // Loesungen ganzzahlig und MS-gerecht ohne Wurzel-Eingabe bleiben.
  function genPythagoras(diff){
    diff = diff || 2;
    var tripel = (diff===1)
      ? choice([[3,4,5],[6,8,10]])
      : (diff===3
          ? choice([[5,12,13],[9,12,15],[8,15,17],[10,24,26]])
          : choice([[3,4,5],[6,8,10],[5,12,13],[9,12,15]]));
    var a = tripel[0], b = tripel[1], c = tripel[2];   // a, b = Katheten; c = Hypotenuse
    var fall = rand(1,3);   // 1 = Hypotenuse, 2 = Kathete a, 3 = Kathete b gesucht
    var a2 = a*a, b2 = b*b, c2 = c*c;

    // triangleFromSides(BC, CA, AB): BC = Hypotenuse c, CA = b, AB = a
    // => rechter Winkel bei A (Index 0).
    var pts = normalizeAndScale(triangleFromSides(c, b, a), 300, 220, 40);
    var labels, answer, frage, erklaerung;
    if(fall===1){
      labels = ["a = "+a+" cm", "?", "b = "+b+" cm"];
      answer = c;
      frage = "Berechne die Länge der Hypotenuse c (die Seite gegenüber dem rechten Winkel).";
      erklaerung = "c² = a² + b² = "+a+"² + "+b+"² = "+a2+" + "+b2+" = "+c2+", also c = √"+c2+" = "+c+" cm.";
    } else if(fall===2){
      labels = ["?", "c = "+c+" cm", "b = "+b+" cm"];
      answer = a;
      frage = "Berechne die Länge der Kathete a (eine der beiden Seiten am rechten Winkel).";
      erklaerung = "a² = c² - b² = "+c2+" - "+b2+" = "+a2+", also a = √"+a2+" = "+a+" cm.";
    } else {
      labels = ["a = "+a+" cm", "c = "+c+" cm", "?"];
      answer = b;
      frage = "Berechne die Länge der Kathete b (eine der beiden Seiten am rechten Winkel).";
      erklaerung = "b² = c² - a² = "+c2+" - "+a2+" = "+b2+", also b = √"+b2+" = "+b+" cm.";
    }
    var svg = polygonSVG(pts, {
      color:COLORS.dreieck.main, soft:COLORS.dreieck.soft,
      sideLabels:labels, labelOffset:16, rightAngleAt:0
    });
    var ex = baseEx("dreieck","pythagoras");
    ex.question = frage;
    ex.hint = "Satz des Pythagoras: a² + b² = c². c ist die Hypotenuse - gegenüber dem rechten Winkel.";
    ex.svg = svg; ex.badge = "Dreieck · Pythagoras"; ex.badgeColor = COLORS.dreieck.main;
    ex.inputType = "number"; ex.unit = "cm";
    ex.answer = answer;
    ex.explanation = erklaerung;
    return ex;
  }

  // 6) Fläche Rechteck / Quadrat
  function genRechteckFlaeche(diff){
    diff = diff || 2;
    var isSquare = Math.random()<0.4;
    var lo=diff===1?2:(diff===3?4:3), hi=diff===1?7:(diff===3?25:12);
    var a = rand(lo,hi), b = isSquare? a : rand(lo,hi);
    while(!isSquare && b===a){ b=rand(lo,hi); }
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
  function genParallelogrammFlaeche(diff){
    diff = diff || 2;
    var g = diff===1?rand(3,8):(diff===3?rand(6,25):rand(5,14)), h = diff===1?rand(2,5):(diff===3?rand(4,18):rand(3,10));
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
  function genTrapezFlaeche(diff){
    diff = diff || 2;
    var a = diff===1?rand(5,10):(diff===3?rand(10,30):rand(8,16)); // lange parallele Seite (unten)
    var c = rand(3,a-2); // kurze parallele Seite (oben)
    var h = diff===1?rand(2,6):(diff===3?rand(4,18):rand(3,10));
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
  function genDreieckErkennen(diff){
    diff = diff || 2;
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = "Richtig ist: "+correct+".";
    return ex;
  }

  // 10) Viereck erkennen
  function genViereckErkennen(diff){
    diff = diff || 2;
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
    ex.answer = ex.choices[ex.correctIndex];
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

  function genEigenschaftenDreieck(diff){
    diff = diff || 2;
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = s.v ? "Die Aussage stimmt." : "Die Aussage stimmt nicht.";
    return ex;
  }
  function genEigenschaftenViereck(diff){
    diff = diff || 2;
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = s.v ? "Die Aussage stimmt." : "Die Aussage stimmt nicht.";
    return ex;
  }

  /* ============ H3: Kongruenz / Ähnlichkeit / Konstruktionen ============ */

  function genKongruenzKonstruktionen(diff){
    diff = diff || 2;
    var typ = rand(0, 2);

    /* ---- Hilfsfunktionen ---- */
    function winkelGegenueber(a, b, c){
      var cosW = (b*b + c*c - a*a) / (2*b*c);
      if(cosW > 1) cosW = 1; if(cosW < -1) cosW = -1;
      return Math.round(Math.acos(cosW) * 180 / Math.PI);
    }
    function duoSVG(svgA, svgB){
      var innerA = String(svgA).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
      var innerB = String(svgB).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
      return '<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="translate(30,10)">'+innerA+'</g>' +
        '<g transform="translate(350,10)">'+innerB+'</g>' +
        '</svg>';
    }

    /* ---- Typ 0: Kongruenz Ja/Nein (SSS) ----
       Zwei Dreiecke mit Tick-Markierungen; kongruent = gleiche Seiten (ggf. permutiert),
       nicht kongruent = eine Seite unterschiedlich lang (anderer Tick). ---- */
    if(typ === 0){
      var kongruent = Math.random() < 0.5;
      var a, b, c;
      do{
        a = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
        b = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
        c = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
      } while(!isValidTriangle(a,b,c));

      var pts1 = normalizeAndScale(triangleFromSides(a,b,c), 300, 220, 34);
      var ticks1 = [1, 2, 3];

      var pts2, ticks2, isCongruent;
      if(kongruent){
        var perm = rand(0, 5);
        var seiten = [a, b, c];
        var s2 = [seiten[perm%3], seiten[(perm+1)%3], seiten[(perm+2)%3]];
        pts2 = normalizeAndScale(triangleFromSides(s2[0], s2[1], s2[2]), 300, 220, 34);
        var tickMap = {};
        tickMap[a] = 1; tickMap[b] = 2; tickMap[c] = 3;
        if(a===b) tickMap[b] = tickMap[a];
        if(b===c) tickMap[c] = tickMap[b];
        if(a===c) tickMap[c] = tickMap[a];
        ticks2 = [tickMap[s2[0]], tickMap[s2[1]], tickMap[s2[2]]];
        isCongruent = true;
      } else {
        var c2 = c + (diff===1?2:(diff===3?4:3));
        if(!isValidTriangle(a,b,c2)){ c2 = Math.max(a,b) - 1; if(c2 < 1) c2 = 1; }
        pts2 = normalizeAndScale(triangleFromSides(a,b,c2), 300, 220, 34);
        ticks2 = [1, 2, 4];
        isCongruent = false;
      }

      var svg = duoSVG(
        polygonSVG(pts1, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:ticks1}),
        polygonSVG(pts2, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:ticks2})
      );

      var ex = baseEx("kongruenz","kongruenz");
      ex.question = "Sind diese beiden Dreiecke kongruent (deckungsgleich)?";
      ex.hint = kongruent
        ? "Kongruent bedeutet: alle entsprechenden Seiten sind gleich lang (gleiche Anzahl Tick-Striche). Die Dreiecksform ist identisch, auch wenn sie gedreht oder gespiegelt liegt."
        : "SSS-Kriterium: Alle drei Seiten müssen paarweise gleich lang sein. Bereits eine anders lange Seite bedeutet „nicht kongruent“. Achte auf die Tick-Striche.";
      ex.svg = svg; ex.badge = "Kongruenz · Kongruenz prüfen"; ex.badgeColor = COLORS.dreieck.main;
      ex.inputType = "mc"; ex.choices = ["Ja, kongruent", "Nein, nicht kongruent"];
      ex.correctIndex = kongruent ? 0 : 1;
      ex.answer = ex.choices[ex.correctIndex];
      ex.explanation = kongruent
        ? "Ja, kongruent: die Dreiecke sind kongruent; entsprechende Seiten haben die gleichen Tick-Markierungen und damit die gleiche Länge (SSS)."
        : "Nein, nicht kongruent: die Dreiecke sind nicht kongruent; mindestens eine Seite hat eine andere Länge (unterschiedliche Tick-Anzahl), das SSS-Kriterium ist nicht erfuellt.";
      return ex;
    }

    /* ---- Typ 1: Ähnlichkeit Ja/Nein ----
       Zwei Dreiecke; ähnlich = gleiche Winkel, Seiten um Faktor gestreckt. ---- */
    if(typ === 1){
      var a, b, c;
      do{
        a = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
        b = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
        c = diff===1?rand(4,8):(diff===3?rand(6,16):rand(5,12));
      } while(!isValidTriangle(a,b,c));

      var similar = Math.random() < 0.5;
      var pts1 = normalizeAndScale(triangleFromSides(a,b,c), 300, 220, 34);

      var pts2, faktor, isSimilar;
      if(similar){
        faktor = diff===1 ? 2 : (diff===3 ? rand(2,4) : rand(2,3));
        var a2 = a*faktor, b2 = b*faktor, c2 = c*faktor;
        pts2 = normalizeAndScale(triangleFromSides(a2,b2,c2), 300, 220, 34);
        isSimilar = true;
      } else {
        var c2 = c * (diff===1 ? 1.6 : (diff===3 ? 2.2 : 1.8));
        if(!isValidTriangle(a,b,c2)){ c2 = (a+b) * 0.55; }
        pts2 = normalizeAndScale(triangleFromSides(a,b,c2), 300, 220, 34);
        isSimilar = false;
        faktor = 0;
      }

      var svg = duoSVG(
        polygonSVG(pts1, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:[1,2,3]}),
        polygonSVG(pts2, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:[1,2,3]})
      );

      var ex = baseEx("kongruenz","aehnlichkeit");
      ex.question = "Sind diese beiden Dreiecke ähnlich? (Gleiche Winkel, proportionale Seiten)";
      ex.hint = similar
        ? "Ähnliche Dreiecke haben die gleichen Winkel, aber die Seiten sind um einen Streckfaktor gestreckt. Alle drei Winkel müssen paarweise gleich sein."
        : "Achte auf die Form: Sind alle drei Winkel paarweise gleich groß? Wenn auch nur ein Winkel anders ist, sind sie nicht ähnlich.";
      ex.svg = svg; ex.badge = "Kongruenz · Ähnlichkeit"; ex.badgeColor = COLORS.dreieck.main;
      ex.inputType = "mc"; ex.choices = ["Ja, ähnlich", "Nein, nicht ähnlich"];
      ex.correctIndex = isSimilar ? 0 : 1;
      ex.answer = ex.choices[ex.correctIndex];
      if(isSimilar){
        ex.explanation = "Ja, ähnlich: die Dreiecke sind ähnlich; die Winkel sind paarweise gleich und die Seiten stehen im Verhältnis 1 : "+faktor+" (Streckfaktor).";
      } else {
        ex.explanation = "Nein, nicht ähnlich: die Dreiecke sind nicht ähnlich; mindestens ein Winkel ist unterschiedlich groß, die Formen stimmen nicht uberein.";
      }
      return ex;
    }

    /* ---- Typ 2: Kongruenzsatz bestimmen ----
       Zeigt zwei kongruente Dreiecke mit markierten gleichen Seiten (Ticks) und Winkeln.
       Schüler bestimmt den Kongruenzsatz (SSS, SWS, WSW) oder "keiner / nicht eindeutig" (SSW). ---- */
    {
      var satzTyp = rand(0, 3); // 0=SSS, 1=SWS, 2=WSW, 3=SSW-nicht-eindeutig
      var a, b, c;
      do{
        a = diff===1?rand(5,9):(diff===3?rand(7,14):rand(6,11));
        b = diff===1?rand(5,9):(diff===3?rand(7,14):rand(6,11));
        c = diff===1?rand(5,9):(diff===3?rand(7,14):rand(6,11));
      } while(!isValidTriangle(a,b,c));

      var pts = normalizeAndScale(triangleFromSides(a,b,c), 300, 220, 34);
      var w = [winkelGegenueber(a,b,c), winkelGegenueber(b,c,a), winkelGegenueber(c,a,b)];
      // Seite 0=AB=c, Seite 1=BC=a, Seite 2=CA=b
      // Winkel Index 0=A (zwischen Seite 2 und 0), 1=B (zwischen 0 und 1), 2=C (zwischen 1 und 2)

      var korrekt, ticks, angleLabels;
      if(satzTyp === 0){
        korrekt = "SSS";
        ticks = [1, 1, 1];
        angleLabels = [null, null, null];
      } else if(satzTyp === 1){
        korrekt = "SWS";
        ticks = [1, 0, 1];
        angleLabels = [w[0]+"°", null, null];
      } else if(satzTyp === 2){
        korrekt = "WSW";
        ticks = [0, 0, 1];
        angleLabels = [w[0]+"°", null, w[2]+"°"];
      } else {
        korrekt = "keiner / nicht eindeutig";
        ticks = [1, 1, 0];
        angleLabels = [null, null, w[2]+"°"];
      }

      var svg = duoSVG(
        polygonSVG(pts, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:ticks, angleLabels:angleLabels}),
        polygonSVG(pts, {color:COLORS.dreieck.main, soft:COLORS.dreieck.soft, ticks:ticks, angleLabels:angleLabels})
      );

      var ex = baseEx("kongruenz","kongruenzsatz");
      ex.question = "Welcher Kongruenzsatz rechtfertigt, dass diese beiden Dreiecke kongruent sind?";
      ex.hint = "SSS = alle 3 Seiten gleich · SWS = 2 Seiten + eingeschlossener Winkel gleich · WSW = 2 Winkel + eingeschlossene Seite gleich · SSW bestimmt ein Dreieck NICHT eindeutig.";
      ex.svg = svg; ex.badge = "Kongruenz · Kongruenzsatz"; ex.badgeColor = COLORS.dreieck.main;
      ex.inputType = "mc";
      var pool = ["SSS", "SWS", "WSW", "keiner / nicht eindeutig"];
      var wrongs = shuffle(pool.filter(function(o){ return o !== korrekt; })).slice(0, 3);
      ex.choices = shuffle([korrekt].concat(wrongs));
      ex.correctIndex = ex.choices.indexOf(korrekt);
      ex.answer = ex.choices[ex.correctIndex];
      ex.explanation = "Richtig ist: "+korrekt+". Die markierten gleichen Seiten (Tick-Striche) und Winkel zeigen, dass dieses Kriterium erfüllt ist.";
      return ex;
    }

    // Fallback (sollte nicht erreicht werden)
    return genKongruenzKonstruktionen(2);
  }

  /* ============ Phase 3: Kreis ============ */
  function genKreisUmfang(diff){
      diff = diff || 2;
      var r = diff===1?rand(2,5):(diff===3?rand(6,20):rand(2,10));
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

  function genKreisFlaeche(diff){
    diff = diff || 2;
    var r = diff===1?rand(2,5):(diff===3?rand(6,20):rand(2,10));
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

  function genQuaderVolumen(diff){
    diff = diff || 2;
    var l=(diff===1?rand(2,5):(diff===3?rand(4,15):rand(3,10))), b=(diff===1?rand(1,4):(diff===3?rand(3,12):rand(2,8))), h=(diff===1?rand(1,4):(diff===3?rand(3,12):rand(2,8)));
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

  function genWuerfelVolumen(diff){
    diff = diff || 2;
    var a = diff===1?rand(1,4):(diff===3?rand(5,15):rand(2,9));
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

  function genZylinderVolumen(diff){
    diff = diff || 2;
    var r = diff===1?rand(1,4):(diff===3?rand(4,12):rand(2,7)), h = diff===1?rand(2,6):(diff===3?rand(6,20):rand(3,12));
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

  function genQuaderOberflaeche(diff){
    diff = diff || 2;
    var l=(diff===1?rand(2,5):(diff===3?rand(4,15):rand(3,10))), b=(diff===1?rand(1,4):(diff===3?rand(3,12):rand(2,8))), h=(diff===1?rand(1,4):(diff===3?rand(3,12):rand(2,8)));
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

  function genWuerfelOberflaeche(diff){
    diff = diff || 2;
    var a = diff===1?rand(1,4):(diff===3?rand(5,15):rand(3,10));
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

  function genZylinderOberflaeche(diff){
    diff = diff || 2;
    var r = diff===1?rand(1,4):(diff===3?rand(4,12):rand(2,6)), h = diff===1?rand(2,6):(diff===3?rand(5,16):rand(3,10));
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

  /* ============ P1.14: Weitere 3D-Körper (Pyramide, Prisma, Kegel, Kugel) ============ */

  function pyramideSVG(a,h,color,soft){
    var scale=Math.min(110/Math.max(a,4),11);
    var half=Math.max(a*scale*0.5,26);
    var apexY=32, baseY=apexY+Math.min(h*7,105);
    var cx=150, dep=half*0.55;
    var FL={x:cx-half,y:baseY}, FR={x:cx+half,y:baseY};
    var BR={x:FR.x+dep,y:FR.y-dep*0.6}, BL={x:FL.x+dep,y:FL.y-dep*0.6};
    var A={x:cx+dep*0.5,y:apexY};
    function P(pts){return pts.map(function(p){return p.x+" "+p.y;}).join(" L ");}
    var s='<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s+='<path d="M '+P([FL,FR,BR,BL])+' Z" fill="'+soft+'" fill-opacity="0.55" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    s+='<path d="M '+P([FL,BL,A])+' Z" fill="'+color+'" fill-opacity="0.28" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    s+='<path class="shape-outline" d="M '+P([FL,FR,A])+' Z" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5" stroke-linejoin="round"/>';
    s+='<line class="measure-line" x1="'+FL.x+'" y1="'+(baseY+16)+'" x2="'+FR.x+'" y2="'+(baseY+16)+'"/>';
    s+='<text class="dim-label" x="'+cx+'" y="'+(baseY+32)+'" text-anchor="middle">a = '+a+' cm</text>';
    s+='<line class="measure-line" x1="'+(A.x+22)+'" y1="'+A.y+'" x2="'+(A.x+22)+'" y2="'+baseY+'"/>';
    s+='<text class="dim-label" x="'+(A.x+28)+'" y="'+((A.y+baseY)/2)+'" text-anchor="start" dominant-baseline="middle">h = '+h+' cm</text>';
    s+='</svg>';
    return s;
  }

  function prismaSVG(g,hg,H,color,soft){
    var scale=Math.min(120/Math.max(g,4),12);
    var halfW=Math.max(g*scale*0.5,26);
    var triH=Math.max(hg*scale*0.5,22);
    var botY=168, topY=botY-triH;
    var cx=132, dep=Math.min(H*scale*0.4,42);
    var FL={x:cx-halfW,y:botY}, FR={x:cx+halfW,y:botY}, T={x:cx,y:topY};
    var FL2={x:FL.x+dep,y:FL.y-dep*0.5}, FR2={x:FR.x+dep,y:FR.y-dep*0.5}, T2={x:T.x+dep,y:T.y-dep*0.5};
    function P(pts){return pts.map(function(p){return p.x+" "+p.y;}).join(" L ");}
    var s='<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s+='<path d="M '+P([FL2,FR2,T2])+' Z" fill="'+color+'" fill-opacity="0.18" stroke="'+color+'" stroke-width="2"/>';
    s+='<path d="M '+P([T,FR,FR2,T2])+' Z" fill="'+color+'" fill-opacity="0.28" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    s+='<path d="M '+P([FR,FL,FL2,FR2])+' Z" fill="'+soft+'" fill-opacity="0.6" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round"/>';
    s+='<path class="shape-outline" d="M '+P([FL,FR,T])+' Z" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5" stroke-linejoin="round"/>';
    s+='<text class="dim-label" x="'+cx+'" y="'+(botY+18)+'" text-anchor="middle">g = '+g+' cm</text>';
    s+='<text class="dim-label" x="'+(cx-8)+'" y="'+((topY+botY)/2)+'" text-anchor="end" dominant-baseline="middle">'+hg+' cm</text>';
    s+='<text class="dim-label" x="'+((FR.x+FR2.x)/2+6)+'" y="'+((FR.y+FR2.y)/2)+'" text-anchor="start">H = '+H+' cm</text>';
    s+='</svg>';
    return s;
  }

  function kegelSVG(r,h,color,soft){
    var scaleR=Math.min(60/Math.max(r,4),12);
    var Rpx=r*scaleR;
    var Hpx=Math.min(h*7,120);
    var cx=150, baseY=162, apexY=baseY-Hpx;
    var ry=Math.max(Rpx*0.3,9);
    var s='<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s+='<path class="shape-outline" d="M '+(cx-Rpx)+' '+baseY+' L '+cx+' '+apexY+' L '+(cx+Rpx)+' '+baseY+' Z" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5" stroke-linejoin="round"/>';
    s+='<ellipse cx="'+cx+'" cy="'+baseY+'" rx="'+Rpx+'" ry="'+ry+'" fill="'+soft+'" fill-opacity="0.5" stroke="'+color+'" stroke-width="3"/>';
    s+='<line class="measure-line" x1="'+cx+'" y1="'+apexY+'" x2="'+cx+'" y2="'+baseY+'" stroke-dasharray="4 3"/>';
    s+='<text class="dim-label" x="'+(cx+8)+'" y="'+((apexY+baseY)/2)+'" text-anchor="start">h = '+h+' cm</text>';
    s+='<line class="measure-line" x1="'+cx+'" y1="'+baseY+'" x2="'+(cx+Rpx)+'" y2="'+baseY+'"/>';
    s+='<text class="dim-label" x="'+(cx+Rpx/2)+'" y="'+(baseY+18)+'" text-anchor="middle">r = '+r+' cm</text>';
    s+='</svg>';
    return s;
  }

  function kugelSVG(r,color,soft){
    var scale=Math.min(76/Math.max(r,4),12);
    var Rpx=r*scale;
    var cx=150, cy=112;
    var s='<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+Rpx+'" fill="'+soft+'" stroke="'+color+'" stroke-width="3.5"/>';
    s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+Rpx+'" ry="'+(Rpx*0.3)+'" fill="none" stroke="'+color+'" stroke-width="1.8" stroke-dasharray="5 4"/>';
    s+='<line class="measure-line" x1="'+cx+'" y1="'+cy+'" x2="'+(cx+Rpx)+'" y2="'+cy+'"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="2.5" fill="'+color+'"/>';
    s+='<text class="dim-label" x="'+(cx+Rpx/2)+'" y="'+(cy-8)+'" text-anchor="middle">r = '+r+' cm</text>';
    s+='</svg>';
    return s;
  }

  /* Weitere 3D-Körper: Pyramide, Prisma (ganzzahlige Antworten), Kegel, Kugel (π, Toleranz). */
  function genWeitereKoerper(diff){
    diff = diff || 2;
    var farbe=COLORS.koerper.main, weich=COLORS.koerper.soft;
    var ex = baseEx("koerper","volumen");
    ex.badgeColor = farbe; ex.inputType="number"; ex.unit="cm³";
    var bodies = diff===1 ? ["pyramide","prisma"] : ["pyramide","prisma","kegel","kugel"];
    var body = choice(bodies);

    if(body==="pyramide"){
      var a = diff===1?choice([3,6]):(diff===3?choice([6,9,12]):choice([3,6,9]));
      var h = diff===1?rand(2,4):(diff===3?rand(6,15):rand(3,8));
      var V = a*a*h/3;
      ex.question="Berechne das Volumen dieser Pyramide (Grundseite a = "+a+" cm, Höhe h = "+h+" cm).";
      ex.hint="V = (1/3) · G · h, Grundfläche G = a². Also V = a² · h : 3.";
      ex.svg=pyramideSVG(a,h,farbe,weich); ex.badge="Pyramide · Volumen";
      ex.answer=V; ex.tolerance=0;
      ex.explanation="G = a² = "+a+"² = "+(a*a)+" cm². V = (1/3)·"+(a*a)+"·"+h+" = "+(a*a*h)+" : 3 = "+V+" cm³.";
    } else if(body==="prisma"){
      var g = diff===1?choice([4,6]):(diff===3?choice([6,8,10,12]):choice([4,6,8]));
      var hg = diff===1?rand(2,4):(diff===3?rand(3,9):rand(2,6));
      var H = diff===1?rand(3,8):(diff===3?rand(6,18):rand(4,12));
      var Vp = (g*hg/2)*H;
      ex.question="Berechne das Volumen dieses Prismas (Grundseite g = "+g+" cm, Höhe des Grunddreiecks "+hg+" cm, Körperhöhe H = "+H+" cm).";
      ex.hint="V = G · H, Grundfläche G = Dreieck = g · hg : 2. Also V = (g · hg : 2) · H.";
      ex.svg=prismaSVG(g,hg,H,farbe,weich); ex.badge="Prisma · Volumen";
      ex.answer=Vp; ex.tolerance=0;
      ex.explanation="G = g · hg : 2 = "+g+" · "+hg+" : 2 = "+(g*hg/2)+" cm². V = G · H = "+(g*hg/2)+" · "+H+" = "+Vp+" cm³.";
    } else if(body==="kegel"){
      var r = diff===3?choice([3,6,9]):rand(2,6), h2 = diff===3?rand(6,18):rand(3,10);
      ex.question="Berechne das Volumen dieses Kegels (Radius r = "+r+" cm, Höhe h = "+h2+" cm).";
      ex.hint="V = (1/3) · π · r² · h. Rechne mit π ≈ 3,14.";
      ex.svg=kegelSVG(r,h2,farbe,weich); ex.badge="Kegel · Volumen";
      ex.tolerance=Math.max(1, r*r*h2/3*0.02); ex.answer=Math.PI*r*r*h2/3;
      ex.explanation="V = (1/3)·π·r²·h ≈ 3,14 · "+r+"² · "+h2+" : 3 = "+fmt(3.14*r*r*h2/3)+" cm³.";
    } else { // kugel
      var giveD = diff===3 && Math.random()<0.5;
      var rk = diff===3?choice([3,6,9]):rand(2,6);
      if(giveD){
        var dk=2*rk;
        ex.question="Berechne das Volumen dieser Kugel (Durchmesser d = "+dk+" cm).";
        ex.hint="V = (4/3) · π · r³. Der Radius ist die Hälfte des Durchmessers: r = d : 2. Rechne mit π ≈ 3,14.";
      } else {
        ex.question="Berechne das Volumen dieser Kugel (Radius r = "+rk+" cm).";
        ex.hint="V = (4/3) · π · r³. Rechne mit π ≈ 3,14.";
      }
      ex.svg=kugelSVG(rk,farbe,weich); ex.badge="Kugel · Volumen";
      ex.tolerance=Math.max(1, rk*rk*rk*0.03); ex.answer=4/3*Math.PI*rk*rk*rk;
      ex.explanation="V = (4/3)·π·r³ ≈ (4/3)·3,14·"+rk+"³ = "+fmt(4/3*3.14*rk*rk*rk)+" cm³.";
    }
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

  function genBruchAddition(diff){
    diff = diff || 2;
    var d = diff===1?rand(3,6):(diff===3?rand(8,16):rand(4,10));
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = n1+"/"+d+" + "+n2+"/"+d+" = ("+n1+"+"+n2+")/"+d+" = "+correct+".";
    return ex;
  }

  function genBruchVergleich(diff){
    diff = diff || 2;
    var denomsPool = diff===1?[2,3,4,6]:(diff===3?[2,3,4,5,6,7,8,9,10,12]:[2,3,4,5,6,8,10]);
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = bigger+" ist der größere Bruch.";
    return ex;
  }

  /* ============ Phase 3c: Brüche mit unterschiedlichen Nennern, Mal, Geteilt ============ */

  // kgV (kleinstes gemeinsames Vielfaches)
  function lcm(a,b){ return (a*b) / gcd(a,b); }

  // Addition/Subtraktion mit unterschiedlichen Nennern
  function genBruchAdditionVerschNenner(diff){
    diff = diff || 2;
    var op = choice(["plus","minus"]);
    var pool = diff===1?[2,3,4,6,8]:(diff===3?[2,3,4,5,6,7,8,9,10,12,15]:[2,3,4,5,6,8,10,12]);
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = n1+"/"+d1+" "+opSymbol+" "+n2+"/"+d2+" = "+n1e+"/"+kgV+" "+opSymbol+" "+n2e+"/"+kgV+" = "+resZaehler+"/"+kgV+(g>1?" = "+resZk+"/"+resNk+"":"")+".";
    return ex;
  }

  // Multiplikation
  function genBruchMultiplikation(diff){
    diff = diff || 2;
    var pool = diff===1?[2,3,4,5]:(diff===3?[2,3,4,5,6,7,8,9,10,11,12]:[2,3,4,5,6,7,8,9,10]);
    var n1 = diff===1?rand(1,4):(diff===3?rand(1,12):rand(1,9)), d1 = choice(pool);
    var n2 = diff===1?rand(1,4):(diff===3?rand(1,12):rand(1,9)), d2 = choice(pool);
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
    ex.answer = ex.choices[ex.correctIndex];
    ex.explanation = n1+"/"+d1+" · "+n2+"/"+d2+" = "+resZaehler+"/"+resNenner+(g>1?" = "+resZk+"/"+resNk+"":"")+".";
    return ex;
  }

  // Division
  function genBruchDivision(diff){
    diff = diff || 2;
    var pool = diff===1?[2,3,4,5]:(diff===3?[2,3,4,5,6,7,8,9,10,11,12]:[2,3,4,5,6,7,8,9,10]);
    var n1 = diff===1?rand(1,4):(diff===3?rand(1,12):rand(1,9)), d1 = choice(pool);
    var n2 = diff===1?rand(1,4):(diff===3?rand(1,12):rand(1,9)), d2 = choice(pool);
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
    ex.answer = ex.choices[ex.correctIndex];
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

  function genProzentAnteil(diff){
    diff = diff || 2;
    var total = diff===1?choice([2,4,5,10]):(diff===3?choice([8,16,20,25,40,50]):choice([4,5,8,10,20,25,40,50]));
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
    var labels = choice([["Apfel","Birne","Kirsche","Pflaume"],["Hund","Katze","Vogel","Fisch"],["Rad","Bus","Auto","Zug"]]);
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

  // Einfache Wahrscheinlichkeit: günstige Fälle / mögliche Fälle (H4, I3.M1)
  // diff 1: Urne mit zwei Farben (MC, Bruch-Antwort). diff 2: Urne/Münze/Würfel
  // gemischt (MC, Bruch). diff 3: Würfel/Glücksrad/Komplement (Zahl, %).
  function genWahrscheinlichkeit(diff){
    diff = diff || 2;
    var ex = baseEx("daten","wahrscheinlichkeit");
    var mode;
    if(diff===1) mode = "urne";
    else if(diff===2) mode = choice(["urne","muenze","wuerfel"]);
    else mode = choice(["wuerfel2","glueck","komplement"]);
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    if(mode==="urne"){
      // Urne mit roten + blauen Kugeln; gefragt: P(rot) als Bruch
      var rot = diff===1 ? rand(1,4) : rand(2,6);
      var blau = diff===1 ? rand(1,4) : rand(2,6);
      var total = rot+blau;
      var g = gcd(rot,total);
      var correct = (rot/g)+"/"+(total/g);
      // Distraktoren: wertverschieden vom Correct (Bruchwert-Vergeich),
      // sonst doppelte richtige Antworten (z. B. 1/2 vs. 3/6).
      var cVal = rot/total;
      var candPool = [(blau)+"/"+(total), total+"/"+rot, rot+"/"+(total+1),
        (rot+1)+"/"+total, (total-rot)+"/"+total, "1/"+(total+1), "1/"+total];
      var dSeen = {}, distractSet = [];
      candPool.forEach(function(c){
        var parts = c.split("/");
        var v = (+parts[0])/(+parts[1]);
        if(Math.abs(v-cVal)>1e-9 && !dSeen[c]){ dSeen[c]=1; distractSet.push(c); }
      });
      var options = shuffle([correct].concat(distractSet.slice(0,3)));
      var i, cx;
      svg += '<ellipse cx="150" cy="60" rx="70" ry="18" fill="none" stroke="var(--ink)" stroke-width="3"/>';
      svg += '<path d="M80 60 L95 180 Q150 195 205 180 L220 60" fill="'+COLORS.gleichung.soft+'" stroke="var(--ink)" stroke-width="3"/>';
      for(i=0;i<Math.min(total,8);i++){
        cx = 110+(i%4)*28;
        var cy = 120+Math.floor(i/4)*28;
        var col = i<rot ? COLORS.kreis.main : COLORS.koerper.main;
        svg += '<circle cx="'+cx+'" cy="'+cy+'" r="11" fill="'+col+'" stroke="var(--ink)" stroke-width="2"/>';
      }
      if(total>8) svg += '<text class="dim-label" x="150" y="205" text-anchor="middle">… insgesamt '+rot+' rote + '+blau+' blaue</text>';
      else svg += '<text class="dim-label" x="150" y="205" text-anchor="middle">'+rot+' rote · '+blau+' blaue Kugeln</text>';
      svg += '</svg>';
      ex.question = "In einer Urne liegen "+rot+" rote und "+blau+" blaue Kugeln. Du ziehst blind eine Kugel. Wie groß ist die Wahrscheinlichkeit, dass sie rot ist? (Antwort als gekürzter Bruch, z. B. 1/2.)";
      ex.hint = "Günstige Fälle (rot: "+rot+") durch mögliche Fälle (alle: "+total+"). Kürze den Bruch so weit wie möglich.";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Urne"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="mc"; ex.choices=options; ex.correctIndex=options.indexOf(correct);
      ex.answer = correct;
      ex.explanation = "P(rot) = "+rot+"/"+total+" = "+correct+".";
    } else if(mode==="muenze"){
      // Münzwurf: P(Kopf) = 1/2
      svg += '<circle cx="150" cy="100" r="55" fill="'+COLORS.gleichung.soft+'" stroke="var(--ink)" stroke-width="3"/>';
      svg += '<text class="dim-label" x="150" y="95" text-anchor="middle" font-size="22">Kopf</text>';
      svg += '<text class="dim-label" x="150" y="120" text-anchor="middle" font-size="14">oder Zahl?</text>';
      svg += '<text class="dim-label" x="150" y="195" text-anchor="middle">fairer Münzwurf</text>';
      svg += '</svg>';
      var mCorrect = "1/2";
      var mOptions = shuffle([mCorrect,"1/3","1/4","2/3"]);
      ex.question = "Du wirfst eine faire Münze. Wie groß ist die Wahrscheinlichkeit für „Kopf“? (Antwort als Bruch.)";
      ex.hint = "Zwei gleich wahrscheinliche Fälle (Kopf, Zahl) – einer davon gewinnt.";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Münze"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="mc"; ex.choices=mOptions; ex.correctIndex=mOptions.indexOf(mCorrect);
      ex.answer = mCorrect;
      ex.explanation = "P(Kopf) = 1/2 = 50 %.";
    } else if(mode==="wuerfel"){
      // Würfel: P(gewünschte Augenzahl) = 1/6 als Bruch
      var augen = rand(1,6);
      var wCorrect = "1/6";
      var wOptions = shuffle([wCorrect,"1/5","1/3","1/2"]);
      var dx = 120, dy = 70, ds = 60;
      svg += '<rect x="'+dx+'" y="'+dy+'" width="'+ds+'" height="'+ds+'" rx="10" fill="'+COLORS.gleichung.soft+'" stroke="var(--ink)" stroke-width="3"/>';
      var pips = {1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]}[augen];
      pips.forEach(function(p){
        svg += '<circle cx="'+(dx+ds/2+p[0]*15)+'" cy="'+(dy+ds/2+p[1]*15)+'" r="5" fill="var(--ink)"/>';
      });
      svg += '<text class="dim-label" x="150" y="175" text-anchor="middle" font-size="16">P(du würfelst eine '+augen+')?</text>';
      svg += '<text class="dim-label" x="150" y="200" text-anchor="middle">fairer Würfel (1–6)</text>';
      svg += '</svg>';
      ex.question = "Du würfelst mit einem fairen Würfel. Wie groß ist die Wahrscheinlichkeit, dass du eine "+augen+" würfelst? (Antwort als Bruch.)";
      ex.hint = "Sechs gleich wahrscheinliche Augenzahlen (1–6) – nur eine davon ist die "+augen+".";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Würfel"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="mc"; ex.choices=wOptions; ex.correctIndex=wOptions.indexOf(wCorrect);
      ex.answer = wCorrect;
      ex.explanation = "P("+augen+") = 1/6 (eine von sechs gleich wahrscheinlichen Augenzahlen).";
    } else if(mode==="wuerfel2"){
      // Würfel: P(gerade Zahl) = 3/6 = 50 % (Zahl-Antwort in %)
      svg += '<rect x="120" y="60" width="60" height="60" rx="10" fill="'+COLORS.gleichung.soft+'" stroke="var(--ink)" stroke-width="3"/>';
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(p){
        svg += '<circle cx="'+(150+p[0]*15)+'" cy="'+(90+p[1]*15)+'" r="5" fill="var(--ink)"/>';
      });
      svg += '<text class="dim-label" x="150" y="160" text-anchor="middle" font-size="16">P(gerade Augenzahl)?</text>';
      svg += '<text class="dim-label" x="150" y="185" text-anchor="middle">gerade: 2, 4, 6</text>';
      svg += '<text class="dim-label" x="150" y="208" text-anchor="middle">fairer Würfel (1–6)</text>';
      svg += '</svg>';
      ex.question = "Du würfelst mit einem fairen Würfel. Wie groß ist die Wahrscheinlichkeit für eine gerade Augenzahl (2, 4, 6)? (Antwort in Prozent, ganze Zahl ohne %-Zeichen.)";
      ex.hint = "Drei günstige Fälle (2, 4, 6) von sechs möglichen: 3/6 = 1/2. Rechne in Prozent um (mal 100).";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Würfel"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="number"; ex.unit="%";
      ex.answer = 50;
      ex.explanation = "P(gerade) = 3/6 = 1/2 = 50 %.";
    } else if(mode==="glueck"){
      // Glücksrad: n Sektoren, k Gewinn – Antwort in % (nur ganzzahlige Paare)
      var n = choice([4,5,8,10]);
      var k = rand(1,n-1);
      while((k*100)%n!==0){ k = rand(1,n-1); }
      var pct = (k*100)/n;
      var ang = 360/n;
      var j, a0, a1, x1, y1, x2, y2, large;
      for(j=0;j<n;j++){
        a0 = (j*ang-90)*Math.PI/180; a1 = ((j+1)*ang-90)*Math.PI/180;
        x1 = 150+75*Math.cos(a0); y1 = 100+75*Math.sin(a0);
        x2 = 150+75*Math.cos(a1); y2 = 100+75*Math.sin(a1);
        large = ang>180 ? 1 : 0;
        var fill = j<k ? COLORS.kreis.main : COLORS.gleichung.soft;
        svg += '<path d="M150 100 L'+Math.round(x1)+' '+Math.round(y1)+' A75 75 0 '+large+' 1 '+Math.round(x2)+' '+Math.round(y2)+' Z" fill="'+fill+'" stroke="var(--ink)" stroke-width="2"/>';
      }
      svg += '<circle cx="150" cy="100" r="10" fill="var(--ink)"/>';
      svg += '<text class="dim-label" x="150" y="200" text-anchor="middle">'+k+' von '+n+' Sektoren gewinnen</text>';
      svg += '</svg>';
      ex.question = "Ein Glücksrad hat "+n+" gleich große Sektoren, davon sind "+k+" Gewinn-Sektoren. Wie groß ist die Gewinn-Wahrscheinlichkeit? (Antwort in Prozent, ganze Zahl ohne %-Zeichen.)";
      ex.hint = k+"/"+n+" der Sektoren gewinnen – rechne den Bruch in Prozent um (mal 100).";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Glücksrad"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="number"; ex.unit="%";
      ex.answer = pct;
      ex.explanation = "P(Gewinn) = "+k+"/"+n+" = "+pct+" %.";
    } else {
      // Komplement: Urne, gefragt P(NICHT rot) = P(blau) in %
      var kr = rand(1,5), kb = rand(1,5);
      var kt = kr+kb;
      while((kb*100)%kt!==0){ kr = rand(1,5); kb = rand(1,5); kt = kr+kb; }
      var kpct = (kb*100)/kt;
      svg += '<ellipse cx="150" cy="60" rx="70" ry="18" fill="none" stroke="var(--ink)" stroke-width="3"/>';
      svg += '<path d="M80 60 L95 180 Q150 195 205 180 L220 60" fill="'+COLORS.gleichung.soft+'" stroke="var(--ink)" stroke-width="3"/>';
      var m2, cx2;
      for(m2=0;m2<Math.min(kt,8);m2++){
        cx2 = 110+(m2%4)*28;
        var cy2 = 120+Math.floor(m2/4)*28;
        var col2 = m2<kr ? COLORS.kreis.main : COLORS.koerper.main;
        svg += '<circle cx="'+cx2+'" cy="'+cy2+'" r="11" fill="'+col2+'" stroke="var(--ink)" stroke-width="2"/>';
      }
      svg += '<text class="dim-label" x="150" y="205" text-anchor="middle">'+kr+' rote · '+kb+' blaue Kugeln</text>';
      svg += '</svg>';
      ex.question = "In einer Urne liegen "+kr+" rote und "+kb+" blaue Kugeln. Du ziehst blind eine Kugel. Wie groß ist die Wahrscheinlichkeit, dass sie NICHT rot ist? (Antwort in Prozent, ganze Zahl ohne %-Zeichen.)";
      ex.hint = "„Nicht rot“ heißt blau: "+kb+" von "+kt+" Kugeln. Rechne "+kb+"/"+kt+" in Prozent um.";
      ex.svg=svg; ex.badge="Wahrscheinlichkeit · Urne"; ex.badgeColor=COLORS.gleichung.main;
      ex.inputType="number"; ex.unit="%";
      ex.answer = kpct;
      ex.explanation = "P(nicht rot) = P(blau) = "+kb+"/"+kt+" = "+kpct+" %.";
    }
    return ex;
  }

  // Mittelwert / Modus / Median einer Datenreihe (H4, I3.M2)
  function genMittelwerte(diff){
    diff = diff || 2;
    var ex = baseEx("daten","mittelwerte");
    var mode;
    if(diff===1) mode = "mittelwert";
    else if(diff===2) mode = choice(["mittelwert","modus"]);
    else mode = choice(["mittelwert","modus","median"]);
    var vals = [], i, n, answer;
    if(mode==="mittelwert"){
      var meanBase, offs;
      if(diff===1){ n=5; meanBase=rand(4,12); offs=[-2,-1,0,1,2]; }
      else if(diff===2){ n=6; meanBase=rand(5,15); offs=[-2,-1,0,1,2,0]; }
      else { n=7; meanBase=rand(8,20); offs=[-3,-1,0,1,2,-1,2]; }
      for(i=0;i<n;i++) vals.push(meanBase+offs[i]);
      vals = shuffle(vals);
      var sum=0; for(i=0;i<n;i++) sum+=vals[i];
      answer = sum/n;
    } else if(mode==="modus"){
      n = diff===3 ? 7 : 6;
      var modeVal = rand(3,12);
      var pool=[]; for(i=1;i<=20;i++){ if(i!==modeVal) pool.push(i); }
      pool = shuffle(pool);
      vals = [modeVal,modeVal,modeVal];
      for(i=0;i<n-3;i++) vals.push(pool[i]);
      vals = shuffle(vals);
      answer = modeVal;
    } else {
      n = 7; // ungerade -> ganzzahliger Median
      for(i=0;i<n;i++) vals.push(rand(1,15));
      var sorted = vals.slice().sort(function(a,b){return a-b;});
      answer = sorted[(n-1)/2];
    }
    // SVG: Werte als Kästen
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    var boxW=30, gap=8;
    var totalW = n*boxW + (n-1)*gap;
    var sx = Math.round((300-totalW)/2);
    var soft = COLORS.gleichung.soft;
    for(i=0;i<n;i++){
      var bx = sx + i*(boxW+gap);
      svg += '<rect x="'+bx+'" y="70" width="'+boxW+'" height="40" rx="6" fill="'+soft+'" stroke="var(--ink)" stroke-width="2"/>';
      svg += '<text x="'+(bx+boxW/2)+'" y="96" text-anchor="middle" font-size="18" fill="var(--ink)">'+vals[i]+'</text>';
    }
    svg += '<text class="dim-label" x="150" y="50" text-anchor="middle" font-size="14">'+n+' Werte</text>';
    svg += '</svg>';
    ex.svg = svg;
    ex.badgeColor = COLORS.gleichung.main;
    if(mode==="mittelwert"){
      ex.badge = "Daten · Mittelwert";
      ex.question = "Berechne das arithmetische Mittel (den Mittelwert) dieser "+n+" Werte. (Ganze Zahl.)";
      ex.hint = "Addiere alle "+n+" Werte und teile die Summe durch "+n+".";
      ex.inputType = "number"; ex.unit = ""; ex.tolerance = 0;
      var sum2=0; for(i=0;i<n;i++) sum2+=vals[i];
      ex.answer = sum2/n;
      ex.explanation = "Summe = "+sum2+", Anzahl = "+n+", Mittelwert = "+sum2+" : "+n+" = "+(sum2/n)+".";
    } else if(mode==="modus"){
      ex.badge = "Daten · Modus";
      var others = shuffle((function(){var p=[];for(i=1;i<=20;i++){if(i!==answer)p.push(i);}return p;})()).slice(0,3);
      var opts = shuffle([String(answer), String(others[0]), String(others[1]), String(others[2])]);
      ex.question = "Welcher Wert kommt in dieser Datenreihe am häufigsten vor? (Modus.)";
      ex.hint = "Zähle, wie oft jeder Wert vorkommt. Der häufigste ist der Modus.";
      ex.inputType = "mc"; ex.choices = opts; ex.correctIndex = opts.indexOf(String(answer));
      ex.answer = String(answer);
      var cnt=0; for(i=0;i<n;i++){ if(vals[i]===answer) cnt++; }
      ex.explanation = "Der Wert "+answer+" kommt "+cnt+"× vor – häufiger als alle anderen. Also ist der Modus "+answer+".";
    } else {
      ex.badge = "Daten · Median";
      ex.question = "Sortiere die Werte der Größe nach. Wie groß ist der Median (der mittlere Wert bei "+n+" Werten)? (Ganze Zahl.)";
      ex.hint = "Bringe die Werte in eine Reihenfolge. Bei "+n+" (ungerade) Werten ist der Median der Wert in der Mitte.";
      ex.inputType = "number"; ex.unit = ""; ex.tolerance = 0;
      var s2 = vals.slice().sort(function(a,b){return a-b;});
      ex.answer = s2[(n-1)/2];
      ex.explanation = "Sortiert: "+s2.join(", ")+". Der mittlere (4.) Wert ist "+s2[3]+".";
    }
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

  /* H2: Lineare Funktionen y = m·x + t (Steigung, Graph) */
  function genLineareFunktionen(diff){
    diff = diff || 2;
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;
    var ex = baseEx("gleichung","lineareFunktionen");
    ex.inputType = "number"; ex.tolerance = 0;

    var m, t, aufgabeTyp, frage, antwort, hint, erklaerung, badge;

    if(diff === 1){
      m = 1; t = [0,1,2][Math.floor(Math.random()*3)];
      aufgabeTyp = "steigung";
    } else if(diff === 2){
      m = [1,-1][Math.floor(Math.random()*2)]; t = [-1,0,1][Math.floor(Math.random()*3)];
      aufgabeTyp = "abschnitt";
    } else if(diff === 3){
      m = [2,-2,1,-1][Math.floor(Math.random()*4)]; t = [-2,-1,0,1,2][Math.floor(Math.random()*5)];
      aufgabeTyp = "steigung";
    } else {
      m = [3,-3,2,-2,1,-1][Math.floor(Math.random()*6)]; t = [-3,-2,-1,0,1,2,3][Math.floor(Math.random()*7)];
      aufgabeTyp = "abschnitt";
    }

    // SVG Koordinatensystem: x=-5..5, y=-6..6
    var x0 = 60, y0 = 130;
    var sx = 24, sy = 18;
    var yMin = -6, yMax = 6;
    var xMin = -5, xMax = 5;

    // Zwei Endpunkte der Gerade im sichtbaren Bereich berechnen
    var xe1 = xMin, xe2 = xMax;
    var ye1 = m*xe1 + t, ye2 = m*xe2 + t;

    // Clip auf y-Bereich
    if(ye1 < yMin){ xe1 = (yMin - t)/m; ye1 = yMin; }
    if(ye1 > yMax){ xe1 = (yMax - t)/m; ye1 = yMax; }
    if(ye2 < yMin){ xe2 = (yMin - t)/m; ye2 = yMin; }
    if(ye2 > yMax){ xe2 = (yMax - t)/m; ye2 = yMax; }

    var sx1 = x0 + xe1*sx, sy1 = y0 - ye1*sy;
    var sx2 = x0 + xe2*sx, sy2 = y0 - ye2*sy;

    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    // Achsen
    svg += '<line x1="'+x0+'" y1="'+y0+'" x2="'+(x0+xMax*sx)+'" y2="'+y0+'" stroke="var(--ink)" stroke-width="2"/>';
    svg += '<line x1="'+x0+'" y1="'+(y0+yMax*sy)+'" x2="'+x0+'" y2="'+(y0+yMin*sy)+'" stroke="var(--ink)" stroke-width="2"/>';
    // Pfeile
    svg += '<path d="M '+(x0+xMax*sx)+' '+y0+' l -6 -4 l 0 8 z" fill="var(--ink)"/>';
    svg += '<path d="M '+x0+' '+(y0+yMin*sy)+' l -4 -6 l 8 0 z" fill="var(--ink)"/>';
    // Achsenbeschriftung
    svg += '<text x="'+(x0+xMax*sx+10)+'" y="'+(y0+15)+'" font-size="13" fill="var(--ink)">x</text>';
    svg += '<text x="'+(x0-15)+'" y="'+(y0+yMin*sy-10)+'" font-size="13" fill="var(--ink)">y</text>';
    // Raster
    for(var i = -5; i <= 5; i++){
      var gx = x0 + i*sx;
      if(gx >= 30 && gx <= 270){
        svg += '<line x1="'+gx+'" y1="'+(y0+yMin*sy)+'" x2="'+gx+'" y2="'+(y0+yMax*sy)+'" stroke="var(--paper)" stroke-width="1"/>';
      }
      var gy = y0 - i*sy;
      if(gy >= y0+yMin*sy && gy <= y0+yMax*sy){
        svg += '<line x1="'+(x0+xMin*sx)+'" y1="'+gy+'" x2="'+(x0+xMax*sx)+'" y2="'+gy+'" stroke="var(--paper)" stroke-width="1"/>';
      }
    }
    // Ticks + Beschriftung
    for(var i = -4; i <= 4; i += 2){
      if(i !== 0){
        var gx = x0 + i*sx;
        svg += '<text x="'+gx+'" y="'+(y0+22)+'" font-size="11" text-anchor="middle" fill="var(--ink)">'+i+'</text>';
        var gy = y0 - i*sy;
        svg += '<text x="'+(x0-18)+'" y="'+(gy+4)+'" font-size="11" text-anchor="end" fill="var(--ink)">'+i+'</text>';
      }
    }
    // Ursprung
    svg += '<circle cx="'+x0+'" cy="'+y0+'" r="3" fill="var(--ink)"/>';
    // Gerade
    svg += '<line x1="'+sx1+'" y1="'+sy1+'" x2="'+sx2+'" y2="'+sy2+'" stroke="'+farbe+'" stroke-width="3" stroke-linecap="round"/>';
    svg += '</svg>';

    // Aufgabe
    if(aufgabeTyp === "steigung"){
      frage = "Steigung m der Geraden y = m·x + "+t+" ?";
      antwort = m;
      hint = "Steigung m = Anstieg : Lauf. Gehe 1 Einheit nach rechts – wie viele Einheiten geht die Gerade hoch (oder runter)?";
      erklaerung = "Die Steigung ist m = "+m+". Bei 1 Einheit Lauf steigt die Gerade um "+m+" Einheit(en).";
      badge = "Lineare Funktion · Steigung";
    } else {
      frage = "y-Achsenabschnitt t der Geraden y = "+m+"·x + t ?";
      antwort = t;
      hint = "Der y-Achsenabschnitt ist der Wert, bei dem die Gerade die y-Achse schneidet (x = 0). Lies ihn am Graphen ab.";
      erklaerung = "Der Achsenabschnitt ist t = "+t+". Die Gerade schneidet die y-Achse bei y = "+t+".";
      badge = "Lineare Funktion · Achsenabschnitt";
    }

    ex.question = frage;
    ex.hint = hint;
    ex.svg = svg;
    ex.badge = badge;
    ex.badgeColor = farbe;
    ex.answer = antwort;
    ex.explanation = erklaerung;
    ex.unit = "";
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

  // Indirekte Proportionalität: mehr Leute ⇒ weniger Zeit (H2.I2, P1.19)
  function genIndirekteProportionalitaet(diff){
    diff = diff || 2;
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;
    var kontext = choice([
      {leute:"Bauarbeiter", arbeit:"ein Haus", zeit:"Tage"},
      {leute:"Maler", arbeit:"die Turnhalle", zeit:"Stunden"},
      {leute:"Kinder", arbeit:"den Schulgarten", zeit:"Stunden"}
    ]);
    var f = diff===1 ? 2 : choice([2,3]);
    var wKlein = diff===1 ? rand(2,4) : (diff===3 ? rand(3,9) : rand(2,6));
    var dKlein = diff===1 ? rand(2,6) : (diff===3 ? rand(4,12) : rand(3,8));
    var wGross = wKlein * f, dGross = dKlein * f;
    var mehrLeute = Math.random() < 0.5;
    var wGegeben, dGegeben, wGesucht, antwort;
    if(mehrLeute){ wGegeben = wKlein; dGegeben = dGross; wGesucht = wGross; antwort = dKlein; }
    else { wGegeben = wGross; dGegeben = dKlein; wGesucht = wKlein; antwort = dGross; }
    var gesamt = wGegeben * dGegeben;
    function personenReihe(n, y){
      var o = "";
      var cs = Math.min(16, 230 / n);
      var startX = 150 - (n - 1) * cs / 2;
      for(var i = 0; i < n; i++){
        o += '<circle cx="'+(startX + i*cs)+'" cy="'+y+'" r="'+(cs/2-1)+'" fill="'+farbe+'" stroke="'+weich+'" stroke-width="1"/>';
      }
      return o;
    }
    var maxTage = Math.max(dGegeben, antwort);
    var balkenGegeben = 40 + Math.round(dGegeben / maxTage * 180);
    var balkenGesucht = 40 + Math.round(antwort / maxTage * 180);
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
      '<text x="150" y="22" font-size="13" fill="'+farbe+'" text-anchor="middle" font-weight="bold">Mehr Leute '+(mehrLeute?"\u21D2":"\u21D0")+' '+(mehrLeute?"weniger":"mehr")+' Zeit (indirekt!)</text>' +
      personenReihe(wGegeben, 48) +
      '<text x="150" y="72" font-size="12" fill="'+farbe+'" text-anchor="middle">'+wGegeben+' '+kontext.leute+' \u2192 '+dGegeben+' '+kontext.zeit+'</text>' +
      '<rect x="'+(150-balkenGegeben/2)+'" y="80" width="'+balkenGegeben+'" height="12" fill="'+weich+'" stroke="'+farbe+'" stroke-width="1"/>' +
      personenReihe(wGesucht, 116) +
      '<text x="150" y="140" font-size="12" fill="'+farbe+'" text-anchor="middle">'+wGesucht+' '+kontext.leute+' \u2192 ? '+kontext.zeit+'</text>' +
      '<rect x="'+(150-balkenGesucht/2)+'" y="148" width="'+balkenGesucht+'" height="12" fill="none" stroke="'+farbe+'" stroke-width="1" stroke-dasharray="4 3"/>' +
      '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Gesamtarbeit: '+wGegeben+' \u00B7 '+dGegeben+' = '+gesamt+'</text>' +
      '<text x="150" y="205" font-size="13" fill="'+farbe+'" text-anchor="middle">Wie viele '+kontext.zeit+' brauchen '+wGesucht+' '+kontext.leute+'?</text>' +
      '</svg>';
    var ex = baseEx("gleichung","indirekteProportionalitaet");
    ex.question = wGegeben+' '+kontext.leute+' brauchen '+dGegeben+' '+kontext.zeit+' für '+kontext.arbeit+'. Wie viele '+kontext.zeit+' brauchen '+wGesucht+' '+kontext.leute+'? (Alle arbeiten gleich schnell.)';
    ex.hint = 'Mehr Leute \u21D2 weniger Zeit (indirekt!). Gesamtarbeit: '+wGegeben+' \u00B7 '+dGegeben+' = '+gesamt+'. Teile durch '+wGesucht+'.';
    ex.svg = svg; ex.badge = "Proportionalit\u00E4t \u00B7 Indirekt"; ex.badgeColor = farbe;
    ex.inputType = "number"; ex.unit = kontext.zeit; ex.tolerance = 0;
    ex.answer = antwort;
    ex.explanation = 'Gesamtarbeit: '+wGegeben+' \u00B7 '+dGegeben+' = '+gesamt+'. '+wGesucht+' '+kontext.leute+' \u21D2 '+gesamt+' : '+wGesucht+' = '+antwort+' '+kontext.zeit+'.';
    ex.tips = ['Indirekt hei\u00DFt: mehr Leute, weniger Zeit. Rechne zuerst die Gesamtarbeit (Leute \u00B7 Zeit).'];
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

  /* Zahlenstrahl-SVG: Punkte markieren (mit Vorzeichen-Betragung) */
  function zahlenstrahlSVG(punkte, color, soft){
    punkte = punkte || [];
    var lo = Math.min.apply(null, punkte.concat([0]));
    var hi = Math.max.apply(null, punkte.concat([0]));
    var span = Math.max(hi - lo, 4);
    lo = lo - Math.ceil(span*0.15); hi = hi + Math.ceil(span*0.15);
    var x0 = 34, x1 = 266, y = 130;
    function px(v){ return x0 + (x1 - x0) * (v - lo) / (hi - lo); }
    var svg = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">';
    svg += '<line x1="24" y1="'+y+'" x2="276" y2="'+y+'" stroke="var(--ink)" stroke-width="2"/>';
    svg += '<path d="M 276 '+y+' l -9 -4 l 0 8 z" fill="var(--ink)"/>';
    var step = (hi - lo) <= 12 ? 1 : (hi - lo <= 30 ? 5 : 10);
    for(var t = Math.ceil(lo/step)*step; t <= hi; t += step){
      var tx = px(t);
      svg += '<line x1="'+tx+'" y1="'+(y-5)+'" x2="'+tx+'" y2="'+(y+5)+'" stroke="var(--ink)" stroke-width="1.4"/>';
      svg += '<text class="dim-label" x="'+tx+'" y="'+(y+22)+'" text-anchor="middle">'+t+'</text>';
    }
    var ox = px(0);
    svg += '<line x1="'+ox+'" y1="'+(y-9)+'" x2="'+ox+'" y2="'+(y+9)+'" stroke="'+color+'" stroke-width="2.6"/>';
    punkte.forEach(function(v){
      var cx = px(v);
      svg += '<circle cx="'+cx+'" cy="'+y+'" r="6" fill="'+color+'" stroke="var(--panel)" stroke-width="2"/>';
      svg += '<text x="'+cx+'" y="'+(y-16)+'" text-anchor="middle" font-size="15" font-weight="700" fill="'+color+'">'+v+'</text>';
    });
    svg += '</svg>';
    return svg;
  }

  /* Ganze/negative Zahlen (H1.I3): Ordnen, Addieren mit Vorzeichen, Betrag, Temperatur.
   * diff 1 = Ordnen zweier Zahlen (MC), diff 2 = Addition gleicher/verschiedener Vorzeichen,
   * diff 3 = Temperatur-Differenz bzw. Ketten-Addition. */
  function genGanzeZahlen(diff){
    diff = diff || 2;

    if(diff === 1){
      var a = choice([-9,-7,-5,-4,-3,-2,-1,1,2,3,4,5,7,9]);
      var b = choice([-8,-6,-3,0,2,4,6,8]);
      while(b === a){ b = choice([-8,-6,-3,0,2,4,6,8]); }
      var kleiner = Math.min(a,b);
      var svg = zahlenstrahlSVG([a,b], COLORS.zahl.main, COLORS.zahl.soft);
      var ex = baseEx("zahl","ganzeZahlen");
      ex.question = "Welche Zahl ist kleiner: "+a+" oder "+b+"?";
      ex.hint = "Auf dem Zahlenstrahl liegt die kleinere Zahl weiter links. Negative Zahlen sind kleiner als 0 und als alle positiven Zahlen.";
      ex.svg=svg; ex.badge="Ganze Zahlen · Ordnen"; ex.badgeColor=COLORS.zahl.main;
      var opts = shuffle([String(a), String(b)]);
      ex.inputType="mc"; ex.choices=opts; ex.correctIndex=opts.indexOf(String(kleiner));
      ex.answer = String(kleiner);
      ex.explanation = a+" und "+b+": "+(a<b?""+a+" < "+b:""+b+" < "+a)+", denn die kleinere Zahl liegt weiter links.";
      return ex;
    }

    if(diff === 2){
      var x = diff===2 ? rand(-9,9) : 0;
      var y2 = diff===2 ? rand(-9,9) : 0;
      while(y2 === 0){ y2 = rand(-9,9); }
      while(x === 0){ x = rand(-9,9); }
      var sum = x + y2;
      var svg = zahlenstrahlSVG([x, y2, sum], COLORS.zahl.main, COLORS.zahl.soft);
      var ex = baseEx("zahl","ganzeZahlen");
      var schritt = (x>=0 && y2>=0) ? "beide positiv" :
                    (x<0 && y2<0) ? "beide negativ" : "unterschiedliche Vorzeichen";
      ex.question = "Berechne: ("+x+") + ("+y2+")";
      ex.hint = "Addiere die Beträge. Gleiche Vorzeichen: Beträge addieren, Vorzeichen behalten. Verschiedene Vorzeichen: kleineren Betrag vom größeren abziehen, Vorzeichen des größeren Betrags behalten.";
      ex.svg=svg; ex.badge="Ganze Zahlen · Addition"; ex.badgeColor=COLORS.zahl.main;
      ex.inputType="number"; ex.unit="";
      ex.answer = sum;
      ex.explanation = "("+x+") + ("+y2+") = "+sum+" ("+schritt+").";
      return ex;
    }

    // diff 3: Temperatur-Differenz (Alltagsbezug, negatives Ergebnis gängig).
    // Physikalisch korrekt: Temperaturen sinken in der NACHT (nicht tagsüber).
    // Realistische österreichische Werte: Abend −5..8 °C, Nacht-Abkühlung 3..11 °C
    // ⇒ Morgen −16..5 °C (selten unter −18 °C, wie im Alpenraum üblich).
    var evening = rand(-5, 8);
    var drop = rand(3, 11);
    var morning = evening - drop;
    var svg = zahlenstrahlSVG([evening, morning], COLORS.zahl.main, COLORS.zahl.soft);
    var ex = baseEx("zahl","ganzeZahlen");
    ex.question = "Am Abend sind es "+evening+" °C. In der Nacht sinken die Temperaturen um "+drop+" °C. Wie kalt ist es in der Früh (in °C)?";
    ex.hint = "Sinken heißt minus: "+evening+" − "+drop+". Rechne mit negativen Zahlen – das Ergebnis kann unter null liegen.";
    ex.svg=svg; ex.badge="Ganze Zahlen · Temperatur"; ex.badgeColor=COLORS.zahl.main;
    ex.inputType="number"; ex.unit="°C";
    ex.answer = morning;
    ex.explanation = evening+" °C − "+drop+" °C = "+morning+" °C.";
    return ex;
  }

  /* Dezimalzahl als String mit Komma (österreichische Schreibweise), genau
   * d Nachkommastellen — NICH über fmtAT, das auf 2 Stellen rundet und bei
   * 3 Dezimalen (Faktor 1000) die Anzeige verfälschen würde. */
  function dezimalStr(intTeil, d){
    if(d <= 0) return String(intTeil);
    var frac = "";
    for(var i=0;i<d;i++) frac += String(rand(0,9));
    return intTeil + "," + frac;
  }

  /* ============ P1.13: Einheiten-Umrechnung (Länge, Masse, Geld) ============
   * Didaktisch saubere Dezimal-Treppen: Länge (km·m·cm·mm), Masse (t·kg·g) und
   * Geld (€·ct) laufen über ×10/×100/×1000 — alle schulen dasselbe Modell
   * „Stufen-Tabelle / Komma verschieben". Zeit (×60) bleibt bewusst draußen,
   * um dieses Modell beim ersten Kontakt nicht zu verwässern.
   * Drei Stufen: eine Stufe ×10/×100 (Einstieg) → eine Stufe ×1000 in beide
   * Richtungen (Training) → Dezimal-Komma als Eingabe, ganzzahlige Ausgabe
   * (Anforderung, teils im Alltagssatz). Antwort ist immer ganzzahlig. */
  var EINHEIT_QUANT = {
    laenge: { name:"Länge", steps:[ ["km","m",1000], ["m","cm",100], ["cm","mm",10] ] },
    masse: { name:"Masse", steps:[ ["t","kg",1000], ["kg","g",1000] ] },
    geld:  { name:"Geld",  steps:[ ["€","ct",100] ] }
  };

  function genEinheiten(diff){
    diff = diff || 2;
    var qKey = choice(Object.keys(EINHEIT_QUANT));
    var q = EINHEIT_QUANT[qKey];
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;

    // Referenz: die Umrechnungen dieser Größe als kleine Tabelle
    var tabRows = q.steps.map(function(s){ return ["1 "+s[0], fmtAT(s[2])+" "+s[1]]; });
    var svg = tableSVG(["Umrechnung","="], tabRows, farbe, weich);

    var ex = baseEx("einheiten","einheiten");
    ex.svg = svg; ex.badge = "Einheiten · " + q.name; ex.badgeColor = farbe;

    // Schritt wählen (größere → kleinere Einheit ist immer ×factor)
    var step;
    if(diff === 1){
      var einf = q.steps.filter(function(s){ return s[2] <= 100; });
      step = choice(einf.length ? einf : q.steps);
    } else if(diff === 2){
      var tausend = q.steps.filter(function(s){ return s[2] === 1000; });
      step = choice(tausend.length ? tausend : q.steps);
    } else {
      step = choice(q.steps);
    }
    var bigger = step[0], smaller = step[1], factor = step[2];

    // Richtung & Wert bestimmen
    var toSmaller, d = 0, valueNum, valueStr;
    if(diff === 1){
      toSmaller = true;
      var v = rand(2,9); valueNum = v; valueStr = String(v);
    } else if(diff === 2){
      toSmaller = Math.random() < 0.5;
      if(toSmaller){ var v2 = rand(1,9); valueNum = v2; valueStr = String(v2); }
      else { var gross = rand(2,9)*factor; valueNum = gross; valueStr = String(gross); }
    } else {
      // Dezimal-Eingabe (d Nachkommastellen, d ≤ Stellen von factor) → ganzzahlige Ausgabe
      toSmaller = true;
      var k = String(factor).length - 1;   // 10→1, 100→2, 1000→3
      d = rand(1, k);
      valueStr = dezimalStr(rand(1,9), d);
      valueNum = parseFloat(valueStr.replace(",", "."));
    }

    var fromUnit = toSmaller ? bigger : smaller;
    var toUnit   = toSmaller ? smaller : bigger;
    var answer   = toSmaller ? valueNum * factor : valueNum / factor;

    ex.inputType = "number"; ex.unit = toUnit; ex.tolerance = 0;
    ex.answer = answer;

    var kern = valueStr + " " + fromUnit + " = ? " + toUnit;
    if(diff === 3 && Math.random() < 0.6){
      var sz = {
        laenge: "Ein Wanderweg ist " + valueStr + " " + fromUnit + " lang. Wie viele " + toUnit + " sind das?",
        masse:  "Ein Koffer wiegt " + valueStr + " " + fromUnit + ". Wie viele " + toUnit + " sind das?",
        geld:   "Ein Sackerl kostet " + valueStr + " " + fromUnit + ". Wie viele " + toUnit + " sind das?"
      };
      ex.question = sz[qKey];
    } else {
      ex.question = "Rechne um: " + kern;
    }

    var opWort = toSmaller ? "mal" : "durch";
    var richtungWort = toSmaller ? "kleineren" : "größeren";
    ex.hint = "1 " + bigger + " = " + fmtAT(factor) + " " + smaller +
              ". Du gehst zur " + richtungWort + " Einheit, also " + opWort + " " + fmtAT(factor) + ".";
    ex.explanation = "1 " + bigger + " = " + fmtAT(factor) + " " + smaller + ", also " + kern +
                     " = " + fmtAT(answer) + " " + toUnit + ".";
    return ex;
  }

  /* P1.15: Potenzen & Wurzeln (Basis) — H1/H2 */
  function genPotenzenWurzeln(diff){
    diff = diff || 2;
    var farbe = COLORS.zahl.main, weich = COLORS.zahl.soft;
    var ex = baseEx("potenzenWurzeln","potenzen");
    ex.inputType = "number"; ex.tolerance = 0;

    var istWurzel = Math.random() < 0.5;
    var basis, exp, ergebnis, svgHtml;

    // Zahlenbereich je nach Schwierigkeit
    if(diff === 1){ basis = rand(2,9); exp = 2; }
    else if(diff === 2){
      if(istWurzel){ exp = 2; basis = rand(2,10); }      // nur Quadratwurzel: √4…√100
      else         { exp = rand(2,3); basis = rand(2,10);} // 2²…10² oder 2³…10³
    }
    else {
      exp = rand(2,4); basis = rand(2,20);
      if(istWurzel){ if(exp===3) basis = rand(2,6); if(exp===4) basis = rand(2,4); } // kleine Wurzeln
    }

    ergebnis = Math.pow(basis, exp);

    // Maximale Kantenlänge für die SVG-Darstellung (Performance)
    var MAX_DISP = 12;
    var dispB = Math.min(basis, MAX_DISP);
    var gekuerzt = basis > MAX_DISP;
    var labelKurz = gekuerzt ? '(beispielhaft) ' : '';

    // Hilfsfunktion: zeichnet ein n×n-Grid von Einheitsquadraten
    function quadGrid(n, cs, x, y, f, s, op){
      var o = "";
      for(var i = 0; i < n; i++){
        for(var j = 0; j < n; j++){
          o += '<rect x="'+(x + j*cs)+'" y="'+(y + i*cs)+'" ' +
            'width="'+(cs-1)+'" height="'+(cs-1)+'" ' +
            'fill="'+f+'" stroke="'+s+'" stroke-width="1" ' +
            (op!==undefined ? 'opacity="'+op+'" ' : '') + '/>';
        }
      }
      return o;
    }

    if(istWurzel){
      // Wurzel ziehen: √ergebnis (exp. Wurzel) = basis
      // Die Visualisierung zeigt ein Quadrat aus Einheitsquadraten (Fläche = ergebnis).
      // Die Seitenlänge (= Antwort) wird NICHT angezeigt – Schüler:innen sollen selbst darauf kommen.
      var gradText = exp === 2 ? "" : "<sup>"+exp+"</sup>";
      var cs = Math.floor(150 / dispB);
      if(cs < 5) cs = 5;
      var gs = dispB * cs;
      var x0 = (300 - gs) / 2;
      var y0 = 42;
      var parts = quadGrid(dispB, cs, x0, y0, farbe, weich);
      var wurzelGrad = exp === 2 ? "" : "<tspan font-size=\"14\" dy=\"-8\">"+exp+"</tspan>";
      // Bei Wurzeln ist dispB === basis (niemals gekürzt im Zahlenbereich), daher niemals Seitenlänge nennen.
      var wurzelLabel = gekuerzt
        ? labelKurz + '(beispielhaft) ' + dispB + ' × ' + dispB + ' Felder'
        : ergebnis + ' Einheitsquadrate';
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        parts +
        '<text x="150" y="22" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">√'+ergebnis+wurzelGrad+' = ?</text>' +
        '<text x="150" y="208" font-size="13" fill="'+farbe+'" text-anchor="middle">'+wurzelLabel+'</text>' +
        '</svg>';
      ex.question = "Wurzel ziehen: √"+ergebnis+gradText+" = ?";
      ex.hint = "Welche Zahl, "+exp+"-mal mit sich selbst malgenommen, ergibt "+ergebnis+"?";
      ex.explanation = "√"+ergebnis+" = "+basis+", denn "+basis+"<sup>"+exp+"</sup> = "+fmtAT(ergebnis)+".";
    } else {
      // Potenz bilden: basis^exp = ergebnis
      // Die Visualisierung zeigt das Raster, aber weder das Gesamtergebnis noch eine "="-Rechnung.
      if(exp === 2){
        var cs = Math.floor(150 / dispB);
        if(cs < 5) cs = 5;
        var gs = dispB * cs;
        var x0 = (300 - gs) / 2;
        var y0 = 46;
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          quadGrid(dispB, cs, x0, y0, farbe, weich) +
          '<text x="150" y="24" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+basis+'² = ?</text>' +
          '<text x="150" y="208" font-size="13" fill="'+farbe+'" text-anchor="middle">'+
            (gekuerzt ? labelKurz + '(beispielhaft) ' + dispB + ' × ' + dispB + ' Felder'
                      : dispB + ' × ' + dispB + ' Felder') +
          '</text>' +
          '</svg>';
      } else {
        var maxLay = Math.min(exp, 4);
        var cs = Math.floor(110 / dispB);
        if(cs < 4) cs = 4;
        var gs = dispB * cs;
        var layOff = 10;
        var x0 = (300 - gs - layOff*(maxLay-1)) / 2;
        var y0 = 34;
        var parts = "";
        for(var l = 0; l < maxLay; l++){
          var ox = x0 + l * layOff;
          var oy = y0 - l * 5;
          var op = 1 - l * 0.18;
          parts += quadGrid(dispB, cs, ox, oy, farbe, weich, op);
        }
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          parts +
          '<text x="150" y="18" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+basis+'<tspan font-size="14" dy="-8">'+exp+'</tspan> = ?</text>' +
          '<text x="150" y="208" font-size="13" fill="'+farbe+'" text-anchor="middle">'+
            (gekuerzt ? labelKurz + '(beispielhaft) ' + maxLay + ' Schichten à ' + dispB + '×' + dispB
                      : maxLay+' Schichten à '+dispB+'×'+dispB)+
          '</text>' +
          '</svg>';
      }
      ex.question = "Potenz bilden: "+basis+"<sup>"+exp+"</sup> = ?";
      ex.hint = "Multipliziere "+basis+" "+exp+"-mal mit sich selbst.";
      ex.explanation = basis+"<sup>"+exp+"</sup> = "+fmtAT(ergebnis)+".";
    }
    ex.answer = istWurzel ? basis : ergebnis;
    ex.svg = svgHtml;
    ex.unit = "";
    ex.badge = istWurzel ? "Wurzel · √" : "Potenz · ^"+exp;
    ex.badgeColor = farbe;
    return ex;
  }

  /* P1.18: Zehnerpotenzen / Gleitkomma / negative Exponenten — H1/H2 */
  function genPotenzenErweitert(diff){
    diff = diff || 2;
    var farbe = COLORS.zahl.main, weich = COLORS.zahl.soft;
    var ex = baseEx("potenzen","potenzenErweitert");
    ex.inputType = "number"; ex.tolerance = 0;
    var typ = rand(0,2);
    var ergebnis, svgHtml, badge, frage, hint, erklaerung;
    function nullenBalken(n, maxN, y, label){
      var o = "";
      var cs = Math.min(18, 220 / maxN);
      var startX = 150 - n * cs / 2;
      for(var i = 0; i < n; i++){
        o += '<rect x="'+(startX + i*cs)+'" y="'+y+'" width="'+(cs-2)+'" height="16" fill="'+weich+'" stroke="'+farbe+'" stroke-width="1"/>';
        o += '<text x="'+(startX + i*cs + cs/2)+'" y="'+(y+13)+'" font-size="11" fill="'+farbe+'" text-anchor="middle">0</text>';
      }
      o += '<text x="150" y="'+(y+34)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">'+label+'</text>';
      return o;
    }
    if(typ === 0){
      var n = diff===1 ? rand(2,4) : (diff===3 ? rand(4,7) : rand(3,6));
      ergebnis = Math.pow(10, n);
      badge = "Zehnerpotenz · 10 hoch "+n;
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="28" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">10 hoch '+n+' = ?</text>' +
        '<text x="150" y="52" font-size="13" fill="'+farbe+'" text-anchor="middle">10 hoch '+n+' = 1 mit '+n+' Nullen</text>' +
        nullenBalken(n, 7, 80, "zähle die Nullen: "+n+" Stück") +
        '<text x="150" y="150" font-size="13" fill="'+farbe+'" text-anchor="middle">1 gefolgt von '+n+' Nullen</text>' +
        '<text x="150" y="185" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">10 hoch '+n+' = ?</text>' +
        '<text x="150" y="205" font-size="12" fill="'+farbe+'" text-anchor="middle">Der Exponent sagt, wie viele Nullen folgen</text>' +
        '</svg>';
      frage = "Zehnerpotenz: 10 hoch "+n+" = ? (Der Exponent "+n+" sagt, wie viele Nullen der 1 folgen.)";
      hint = "10 hoch "+n+" = 1 mit "+n+" Nullen. Schreibe 1 und hänge "+n+" Nullen an.";
      erklaerung = "10 hoch "+n+" = 1 mit "+n+" Nullen = "+fmtAT(ergebnis)+".";
    } else if(typ === 1){
      var mant = diff===1 ? rand(2,9) : (rand(11,99)/10);
      var nexp = diff===1 ? rand(2,4) : (diff===3 ? rand(3,6) : rand(2,5));
      ergebnis = Math.round(mant * Math.pow(10, nexp) * 100) / 100;
      badge = "Gleitkomma · a · 10 hoch n";
      var mantAT = String(mant).replace(".", ",");
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="28" font-size="16" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+mantAT+' · 10 hoch '+nexp+' = ?</text>' +
        '<text x="150" y="52" font-size="13" fill="'+farbe+'" text-anchor="middle">Komma '+nexp+' Stellen nach rechts schieben</text>' +
        '<text x="150" y="90" font-size="15" fill="'+farbe+'" text-anchor="middle">'+mantAT+'</text>' +
        '<text x="150" y="112" font-size="13" fill="'+farbe+'" text-anchor="middle">10 hoch '+nexp+' = '+fmtAT(Math.pow(10,nexp))+'</text>' +
        nullenBalken(nexp, 6, 125, "so viele Nullen kommen dazu") +
        '<text x="150" y="195" font-size="13" fill="'+farbe+'" text-anchor="middle">Gleitkomma: Komma um '+nexp+' Stellen nach rechts</text>' +
        '</svg>';
      frage = "Gleitkomma: "+mantAT+" · 10 hoch "+nexp+" = ? (Komma "+nexp+" Stellen nach rechts schieben.)";
      hint = "Schiebe das Komma von "+mantAT+" um "+nexp+" Stellen nach rechts (Nullen anhängen).";
      erklaerung = mantAT+" · 10 hoch "+nexp+" = "+fmtAT(ergebnis)+".";
    } else {
      var bb = diff===1 ? 2 : (diff===3 ? rand(2,5) : rand(2,4));
      var nn = diff===1 ? 1 : (diff===3 ? rand(2,3) : rand(1,2));
      var nenner = Math.pow(bb, nn);
      badge = "Negativer Exponent · a hoch −n";
      var bruchWahl = Math.random() < 0.5;
      if(bruchWahl){
        ergebnis = Math.round((1/nenner) * 1000) / 1000;
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          '<text x="150" y="28" font-size="16" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+bb+' hoch −'+nn+' = ?</text>' +
          '<text x="150" y="52" font-size="13" fill="'+farbe+'" text-anchor="middle">Minus im Exponent ⇒ Kehrwert: 1 : ('+bb+' hoch '+nn+')</text>' +
          '<text x="150" y="90" font-size="15" fill="'+farbe+'" text-anchor="middle">'+bb+' hoch −'+nn+' = 1 : '+nenner+'</text>' +
          '<text x="150" y="115" font-size="13" fill="'+farbe+'" text-anchor="middle">denn '+bb+' hoch '+nn+' = '+nenner+'</text>' +
          '<text x="150" y="150" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">1 : '+nenner+' = ?</text>' +
          '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Als Dezimalzahl (Komma) schreiben</text>' +
          '</svg>';
        frage = "Negativer Exponent: "+bb+" hoch −"+nn+" = ? (Minus heißt Kehrwert: 1 : ("+bb+" hoch "+nn+").)";
        hint = bb+" hoch −"+nn+" = 1 : ("+bb+" hoch "+nn+") = 1 : "+nenner+". Rechne als Dezimalzahl.";
        erklaerung = bb+" hoch −"+nn+" = 1 : "+nenner+" = "+fmt(ergebnis)+".";
      } else {
        ergebnis = nenner;
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          '<text x="150" y="28" font-size="16" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+bb+' hoch −'+nn+' = 1 : ?</text>' +
          '<text x="150" y="52" font-size="13" fill="'+farbe+'" text-anchor="middle">Minus im Exponent ⇒ Kehrwert: 1 : ('+bb+' hoch '+nn+')</text>' +
          '<text x="150" y="90" font-size="15" fill="'+farbe+'" text-anchor="middle">'+bb+' hoch '+nn+' = ?</text>' +
          '<text x="150" y="115" font-size="13" fill="'+farbe+'" text-anchor="middle">rechne zuerst '+bb+' hoch '+nn+' aus</text>' +
          '<text x="150" y="150" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+bb+' hoch −'+nn+' = 1 : ?</text>' +
          '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Gefragt ist der Nenner (die Zahl nach 1 :)</text>' +
          '</svg>';
        frage = bb+" hoch −"+nn+" = 1 : ? (Minus heißt Kehrwert — welche Zahl steht nach 1 : ?)";
        hint = "Minus heißt Kehrwert: "+bb+" hoch −"+nn+" = 1 : ("+bb+" hoch "+nn+"). Rechne "+bb+" hoch "+nn+" aus.";
        erklaerung = bb+" hoch −"+nn+" = 1 : "+nenner+", denn "+bb+" hoch "+nn+" = "+nenner+".";
      }
    }
    ex.question = frage;
    ex.hint = hint;
    ex.explanation = erklaerung;
    ex.answer = ergebnis;
    ex.svg = svgHtml;
    ex.unit = "";
    ex.badge = badge;
    ex.badgeColor = farbe;
    return ex;
  }


  /* P1.16: Teilbarkeit, Primzahlen, kgV/ggT — H1 */
  function genTeilbarkeit(diff){
    diff = diff || 2;
    var farbe = COLORS.zahl.main, weich = COLORS.zahl.soft;
    var ex = baseEx("teilbarkeit","teilbarkeit");
    ex.inputType = "number"; ex.tolerance = 0;
    var typ = rand(0,3);
    var a, b, ergebnis, svgHtml, badge;
    var maxZahl = diff === 1 ? 12 : diff === 2 ? 30 : diff === 3 ? 60 : 100;
    function istPrimzahl(n){ if(n < 2) return false; for(var i = 2; i * i <= n; i++) if(n % i === 0) return false; return true; }
    function naechstePrimzahl(n){ var k = n + 1; while(!istPrimzahl(k)) k++; return k; }
    function ggt(x,y){ while(y !== 0){ var t = y; y = x % y; x = t; } return x; }
    function kgV(x,y){ return x * y / ggt(x,y); }
    function punktReihe(n, cs, x, y, f, s){ var o = ""; for(var i = 0; i < n; i++){ o += '<circle cx="'+(x + i*cs)+'" cy="'+y+'" r="'+(cs/2-1)+'" fill="'+f+'" stroke="'+s+'" stroke-width="1"/>'; } return o; }
    if(typ === 0){
      b = rand(2, Math.min(10, maxZahl));
      a = rand(b+1, maxZahl);
      ergebnis = a % b;
      badge = "Teilbarkeit · ÷";
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        punktReihe(a, Math.floor(260/a), 20, 110, farbe, weich) +
        '<text x="150" y="40" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+' Punkte – Gruppen zu '+b+'</text>' +
        '<text x="150" y="200" font-size="14" fill="'+farbe+'" text-anchor="middle">Wie viele Punkte bleiben übrig?</text>' +
        '</svg>';
      ex.question = a+" ÷ "+b+" = … Rest ?";
      ex.hint = "Teile "+a+" in Gruppen zu "+b+" auf. Was bleibt übrig?";
      ex.explanation = a+" ÷ "+b+" = "+Math.floor(a/b)+" Rest "+ergebnis+", denn "+Math.floor(a/b)+"×"+b+"+"+ergebnis+" = "+a+".";
    } else if(typ === 1){
      a = rand(2, Math.min(40, maxZahl-2));
      ergebnis = naechstePrimzahl(a);
      badge = "Teilbarkeit · Primzahl";
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        punktReihe(a, Math.floor(260/a), 20, 110, farbe, weich) +
        '<text x="150" y="40" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+' Punkte</text>' +
        '<text x="150" y="200" font-size="14" fill="'+farbe+'" text-anchor="middle">Welche ist die nächste Primzahl?</text>' +
        '</svg>';
      ex.question = "Nächste Primzahl nach "+a+" ?";
      ex.hint = "Eine Primzahl ist nur durch 1 und sich selbst teilbar. Tipps: gerade Zahlen (außer 2) sind nie prim. Zahlen, die auf 0 oder 5 enden (außer 5 selbst), nie prim. Probier die nächste ungerade Zahl aus.";
      ex.explanation = "Die nächste Primzahl nach "+a+" ist "+ergebnis+", denn "+ergebnis+" ist nur durch 1 und "+ergebnis+" teilbar.";
    } else if(typ === 2){
      var z1 = rand(2, Math.min(12, maxZahl/2));
      var z2 = rand(2, Math.min(12, maxZahl/2));
      ergebnis = kgV(z1, z2);
      badge = "Teilbarkeit · kgV";
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<line x1="40" y1="90" x2="260" y2="90" stroke="'+weich+'" stroke-width="2"/>' +
        '<line x1="40" y1="140" x2="260" y2="140" stroke="'+weich+'" stroke-width="2"/>' +
        '<text x="40" y="80" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritte von '+z1+'</text>' +
        '<text x="40" y="130" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritte von '+z2+'</text>' +
        '<text x="150" y="40" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">kgV('+z1+", "+z2+") = ?</text>" +
        '<text x="150" y="200" font-size="14" fill="'+farbe+'" text-anchor="middle">Wann treffen sich beide Zahlenstrahlen erstmals?</text>' +
        '</svg>';
      ex.question = "kgV("+z1+", "+z2+") = ? (kgV = kleinstes gemeinsames Vielfaches)";
      ex.hint = "Schreibe die Vielfachen von "+z1+" und "+z2+" auf. Welche Zahl kommt in beiden Listen vor?";
      ex.explanation = "kgV("+z1+", "+z2+") = "+ergebnis+", denn "+ergebnis+" ist die kleinste Zahl, die sowohl durch "+z1+" als auch durch "+z2+" teilbar ist.";
    } else {
      var z1 = rand(2, Math.min(20, maxZahl));
      var z2 = rand(2, Math.min(20, maxZahl));
      ergebnis = ggt(z1, z2);
      badge = "Teilbarkeit · ggT";
      var mx = Math.max(z1, z2);
      var bw1 = 60 + Math.round(z1 / mx * 160), bw2 = 60 + Math.round(z2 / mx * 160);
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="40" y="70" width="'+bw1+'" height="40" fill="'+farbe+'" stroke="'+weich+'" stroke-width="1"><title>Zahl 1</title></rect>' +
        '<rect x="40" y="130" width="'+bw2+'" height="40" fill="'+farbe+'" stroke="'+weich+'" stroke-width="1"><title>Zahl 2</title></rect>' +
        '<text x="40" y="65" font-size="13" fill="'+farbe+'" text-anchor="left">Zahl '+z1+'</text>' +
        '<text x="40" y="125" font-size="13" fill="'+farbe+'" text-anchor="left">Zahl '+z2+'</text>' +
        '<text x="150" y="40" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">ggT('+z1+", "+z2+") = ?</text>" +
        '<text x="150" y="200" font-size="14" fill="'+farbe+'" text-anchor="middle">Welche ist die größte gleiche Teilgröße?</text>' +
        '</svg>';
      ex.question = "ggT("+z1+", "+z2+") = ? (ggT = größter gemeinsamer Teiler)";
      ex.hint = "Schreibe die Teiler von "+z1+" und die Teiler von "+z2+" auf. Welche ist die größte Zahl, die in beiden Listen vorkommt?";
      ex.explanation = "ggT("+z1+", "+z2+") = "+ergebnis+", denn "+ergebnis+" ist die größte Zahl, durch die sowohl "+z1+" als auch "+z2+" ohne Rest teilbar sind.";
    }
    ex.answer = ergebnis;
    ex.svg = svgHtml;
    ex.unit = "";
    ex.badge = badge;
    ex.badgeColor = farbe;
    return ex;
  }

  /* P1.17: Terme vereinfachen / Distributivgesetz — H2 */
  function genTermeDistributiv(diff){
    diff = diff || 2;
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;
    var ex = baseEx("terme","terme");
    ex.inputType = "mc";
    var typ = rand(0,2);
    var a,b,c,x,y,ergebnis,svgHtml,badge;
    var options = [];
    if(typ === 0){
      var plus = Math.random()<0.5;
      var mitCx = Math.random()<0.3 && diff>=2;
      a = diff===1 ? rand(2,3) : (diff===3 ? rand(3,8) : rand(2,5));
      b = diff===1 ? rand(1,4) : (diff===3 ? rand(3,12) : rand(2,8));
      if(mitCx){
        c = rand(2,4);
        ergebnis = (a*c) + "x " + (plus?"+":"−") + " " + (a*b);
        badge = "Distributivgesetz · a·(cx ± b)";
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          '<text x="150" y="55" font-size="18" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+'·('+c+'x '+(plus?"+":"−")+' '+b+')</text>' +
          '<text x="150" y="95" font-size="15" fill="'+farbe+'" text-anchor="middle">= ?</text>' +
          '<text x="150" y="140" font-size="13" fill="'+farbe+'" text-anchor="middle">Klammern auflösen: '+a+'·'+c+'x und '+a+'·'+b+'</text>' +
          '<text x="150" y="180" font-size="13" fill="'+farbe+'" text-anchor="middle">Welcher Term passt?</text>' +
          '</svg>';
        ex.question = a+"·("+c+"x "+(plus?"+":"−")+" "+b+") = ?";
        ex.hint = "Multipliziere "+a+" mit jedem Term in der Klammer: "+a+"·"+c+"x und "+a+"·"+b+".";
        ex.explanation = a+"·("+c+"x "+(plus?"+":"−")+" "+b+") = "+(a*c)+"x "+(plus?"+":"−")+" "+(a*b)+".";
        ex.tips = ["Klammern auflösen: den Faktor vor der Klammer mit jedem Term in der Klammer multiplizieren."];
        options = [
          ergebnis,
          (a*c) + "x " + (plus?"+":"−") + " " + b,
          a + "x " + (plus?"+":"−") + " " + (a*b),
          "x " + (plus?"+":"−") + " " + (a*b)
        ];
      } else {
        ergebnis = a + "x " + (plus?"+":"−") + " " + (a*b);
        badge = "Distributivgesetz · a·(x ± b)";
        svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
          '<text x="150" y="55" font-size="18" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+'·(x '+(plus?"+":"−")+' '+b+')</text>' +
          '<text x="150" y="95" font-size="15" fill="'+farbe+'" text-anchor="middle">= ?</text>' +
          '<text x="150" y="140" font-size="13" fill="'+farbe+'" text-anchor="middle">Klammern auflösen: '+a+'·x und '+a+'·'+b+'</text>' +
          '<text x="150" y="180" font-size="13" fill="'+farbe+'" text-anchor="middle">Welcher Term passt?</text>' +
          '</svg>';
        ex.question = a+"·(x "+(plus?"+":"−")+" "+b+") = ?";
        ex.hint = "Multipliziere "+a+" mit jedem Term in der Klammer: "+a+"·x und "+a+"·"+b+".";
        ex.explanation = a+"·(x "+(plus?"+":"−")+" "+b+") = "+a+"x "+(plus?"+":"−")+" "+(a*b)+".";
        ex.tips = ["Klammern auflösen: den Faktor vor der Klammer mit jedem Term in der Klammer multiplizieren."];
        options = [
          ergebnis,
          a + "x " + (plus?"+":"−") + " " + b,
          "x " + (plus?"+":"−") + " " + (a*b),
          a + "x " + (plus?"+":"−") + " " + (plus?b+a:b-a)
        ];
      }
    } else if(typ === 1){
      var plus = Math.random()<0.5;
      a = diff===1 ? rand(2,3) : (diff===3 ? rand(4,8) : rand(2,5));
      b = rand(2,6);
      while(b===a){ b = rand(2,6); }
      ergebnis = a + "·(x " + (plus?"+":"−") + " " + b + ")";
      badge = "Terme · Ausklammern";
      var xUnit = 60, bUnit = 9, bWidth = Math.min(b * bUnit, 120), totalW = xUnit + bWidth;
      if (totalW > 180) { var sc = 180 / totalW; xUnit *= sc; bWidth *= sc; totalW = 180; }
      var x0 = 150 - totalW / 2;
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="35" font-size="17" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+'·x '+(plus?"+":"−")+' '+a*b+' = ?</text>' +
        '<text x="150" y="60" font-size="14" fill="'+farbe+'" text-anchor="middle">Flächenmodell: '+a+' × (x + '+b+')</text>' +
        '<rect x="'+x0+'" y="85" width="'+totalW+'" height="60" fill="none" stroke="'+farbe+'" stroke-width="2"/>' +
        '<rect x="'+x0+'" y="85" width="'+xUnit+'" height="60" fill="'+weich+'" stroke="'+farbe+'" stroke-width="1"/>' +
        '<rect x="'+(x0+xUnit)+'" y="85" width="'+bWidth+'" height="60" fill="none" stroke="'+farbe+'" stroke-width="1"/>' +
        '<text x="'+(x0+xUnit/2)+'" y="120" font-size="14" fill="'+farbe+'" text-anchor="middle">'+a+'·x</text>' +
        '<text x="'+(x0+xUnit+bWidth/2)+'" y="120" font-size="14" fill="'+farbe+'" text-anchor="middle">'+a+'·'+b+'</text>' +
        '<text x="150" y="175" font-size="13" fill="'+farbe+'" text-anchor="middle">Welcher Term passt?</text>' +
        '</svg>';
      ex.question = "Klammere den gemeinsamen Faktor aus: "+a+"x "+(plus?"+":"−")+" "+(a*b);
      ex.hint = "Welcher Faktor kommt in "+a+"x und in "+(a*b)+" vor? Klammere "+a+" aus.";
      ex.explanation = a+"x "+(plus?"+":"−")+" "+(a*b)+" = "+a+"·(x "+(plus?"+":"−")+" "+b+").";
      ex.tips = ["Welche Zahl kommt in beiden Termen vor? Diese Zahl schreibt man vor die Klammer."];
      options = [
        ergebnis,
        a + "·(x " + (plus?"+":"−") + " " + b + ")",
        "(" + a + "+"+a+")·(x " + (plus?"+":"−") + " " + b + ")",
        a + "·x " + (plus?"+":"−") + " " + b,
        "x " + (plus?"+":"−") + " " + b
      ];
      options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
    } else {
      var plus = Math.random()<0.5;
      a = diff===1 ? rand(2,4) : (diff===3 ? rand(5,12) : rand(3,8));
      var bMin = diff===1 ? 1 : (diff===3 ? 3 : 2);
      var bMax = diff===1 ? 3 : (diff===3 ? 10 : 6);
      b = rand(bMin, bMax);
      while(b===a){ b = rand(bMin, bMax); }
      if(!plus && b > a){ var t = a; a = b; b = t; } // bei − zuerst das Größere → positives Ergebnis (kindgerecht)
      var koeff = plus ? (a+b) : (a-b);
      ergebnis = koeff + "x";
      badge = "Terme · Gleichartige zusammenfassen";
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="55" font-size="18" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+a+'x '+(plus?"+":"−")+' '+b+'x</text>' +
        '<text x="150" y="95" font-size="15" fill="'+farbe+'" text-anchor="middle">= ?</text>' +
        '<text x="150" y="140" font-size="13" fill="'+farbe+'" text-anchor="middle">Gleiche Terme (mit x) zusammenfassen</text>' +
        '<text x="150" y="180" font-size="13" fill="'+farbe+'" text-anchor="middle">Welcher Term passt?</text>' +
        '</svg>';
      ex.question = a+"x "+(plus?"+":"−")+" "+b+"x = ?";
      ex.hint = "Beide Terme haben das x. Addiere bzw. subtrahiere die Zahlen davor: "+a+" "+(plus?"+":"−")+" "+b+" = "+koeff+".";
      ex.explanation = a+"x "+(plus?"+":"−")+" "+b+"x = "+(plus?(a+b):(a-b))+"x = "+koeff+"x."
      ex.tips = ["Beide Terme haben das x. Addiere bzw. subtrahiere die Zahlen davor."];
      options = [
        ergebnis,
        koeff + "",
        (plus?a-b:a+b) + "x",
        (a*b) + "x"
      ];
    }
    options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
    while(options.length < 2){
      options.push(ergebnis + (options.indexOf(ergebnis+"x")===-1 ? "x" : ""));
      options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
    }
    options = shuffle(options);
    ex.choices = options;
    ex.correctIndex = options.indexOf(ergebnis);
    ex.answer = ergebnis;
    ex.svg = svgHtml;
    ex.unit = "";
    ex.badge = badge;
    ex.badgeColor = farbe;
    return ex;
  }

  /* P1.21: Binomische Formeln — H2 (Plus-, Minus- und Plus-Minus-Formel) */
  function genBinomischeFormeln(diff){
    diff = diff || 2;
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;
    var ex = baseEx("terme","binom");
    ex.inputType = "mc";
    var typ = rand(0,2);
    var a,b,ergebnis,svgHtml,badge,options;
    function quadFeld(x, y, s, fill, label){
      return '<rect x="'+x+'" y="'+y+'" width="'+s+'" height="'+s+'" fill="'+fill+'" stroke="'+farbe+'" stroke-width="1"/>' +
        (label ? '<text x="'+(x+s/2)+'" y="'+(y+s/2+5)+'" font-size="13" fill="'+farbe+'" text-anchor="middle">'+label+'</text>' : '');
    }
    if(typ === 0){
      b = diff===1 ? rand(1,3) : (diff===3 ? rand(2,6) : rand(1,5));
      var b2 = b*b;
      ergebnis = "x² + "+(2*b)+"x + "+b2;
      badge = "Binom · Plus-Formel (a + b)²";
      var s = 34, ax = 60, ay = 70, bs = 22;
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="28" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">(x + '+b+')² = x² + 2·'+b+'·x + '+b2+'</text>' +
        quadFeld(ax, ay, s, weich, "x²") +
        '<rect x="'+(ax+s)+'" y="'+ay+'" width="'+bs+'" height="'+s+'" fill="none" stroke="'+farbe+'" stroke-width="1"/>' +
        '<text x="'+(ax+s+bs/2)+'" y="'+(ay+s/2+5)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">'+b+'x</text>' +
        '<rect x="'+ax+'" y="'+(ay+s)+'" width="'+s+'" height="'+bs+'" fill="none" stroke="'+farbe+'" stroke-width="1"/>' +
        '<text x="'+(ax+s/2)+'" y="'+(ay+s+bs/2+5)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">'+b+'x</text>' +
        quadFeld(ax+s, ay+s, bs, weich, b2) +
        '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Quadrat-Modell: (x + '+b+')² — welche Summe passt?</text>' +
        '<text x="150" y="205" font-size="13" fill="'+farbe+'" text-anchor="middle">(a + b)² = a² + 2ab + b²</text>' +
        '</svg>';
      ex.question = "(x + "+b+")² = ? (Plus-Formel: (a + b)² = a² + 2ab + b²)";
      ex.hint = "Plus-Formel: (a + b)² = a² + 2ab + b². Hier: x² + 2·"+b+"·x + "+b+"².";
      ex.explanation = "(x + "+b+")² = x² + 2·"+b+"·x + "+b+"² = x² + "+(2*b)+"x + "+b2+".";
      ex.tips = ["Plus-Formel merken: (a + b)² = a² + 2ab + b² — das Mittelstück 2ab nicht vergessen!"];
      options = [ergebnis, "x² + "+(2*b)+"x + "+b+"", "x² + "+b+"x + "+b2, "x² + "+b2+"x + "+(2*b)];
    } else if(typ === 1){
      b = diff===1 ? 1 : (diff===3 ? rand(1,4) : rand(1,3));
      var b2m = b*b;
      ergebnis = "x² − "+(2*b)+"x + "+b2m;
      badge = "Binom · Minus-Formel (a − b)²";
      var sm = 34, axm = 60, aym = 70, bsm = 22;
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="28" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">(x − '+b+')² = x² − 2·'+b+'·x + '+b2m+'</text>' +
        quadFeld(axm, aym, sm, weich, "x²") +
        '<rect x="'+(axm+sm)+'" y="'+aym+'" width="'+bsm+'" height="'+sm+'" fill="none" stroke="'+farbe+'" stroke-width="1" stroke-dasharray="4 3"/>' +
        '<text x="'+(axm+sm+bsm/2)+'" y="'+(aym+sm/2+5)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">−'+b+'x</text>' +
        '<rect x="'+axm+'" y="'+(aym+sm)+'" width="'+sm+'" height="'+bsm+'" fill="none" stroke="'+farbe+'" stroke-width="1" stroke-dasharray="4 3"/>' +
        '<text x="'+(axm+sm/2)+'" y="'+(aym+sm+bsm/2+5)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">−'+b+'x</text>' +
        quadFeld(axm+sm, aym+sm, bsm, weich, "+"+b2m) +
        '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Minus-Formel: Streifen abziehen, +'+b2m+' bleibt</text>' +
        '<text x="150" y="205" font-size="13" fill="'+farbe+'" text-anchor="middle">(a − b)² = a² − 2ab + b²</text>' +
        '</svg>';
      ex.question = "(x − "+b+")² = ? (Minus-Formel: (a − b)² = a² − 2ab + b²)";
      ex.hint = "Minus-Formel: (a − b)² = a² − 2ab + b². Hier: x² − 2·"+b+"·x + "+b+"².";
      ex.explanation = "(x − "+b+")² = x² − 2·"+b+"·x + "+b+"² = x² − "+(2*b)+"x + "+b2m+".";
      ex.tips = ["Minus-Formel merken: (a − b)² = a² − 2ab + b² — nur das Mittelstück ist minus!"];
      options = [ergebnis, "x² − "+(2*b)+"x − "+b2m, "x² − "+b+"x + "+b2m, "x² + "+(2*b)+"x + "+b2m];
    } else {
      b = diff===1 ? 1 : (diff===3 ? rand(1,4) : rand(1,3));
      var b2p = b*b;
      ergebnis = "x² − "+b2p;
      badge = "Binom · Plus-Minus-Formel (a + b)(a − b)";
      var sp = 36, axp = 70, ayp = 80;
      svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="28" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">(x + '+b+')(x − '+b+') = x² − '+b2p+'</text>' +
        quadFeld(axp, ayp, sp, weich, "x²") +
        '<rect x="'+(axp+sp)+'" y="'+ayp+'" width="22" height="'+sp+'" fill="none" stroke="'+farbe+'" stroke-width="1"/>' +
        '<text x="'+(axp+sp+11)+'" y="'+(ayp+sp/2+5)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">+'+b+'x</text>' +
        '<rect x="'+axp+'" y="'+(ayp+sp)+'" width="'+sp+'" height="22" fill="none" stroke="'+farbe+'" stroke-width="1" stroke-dasharray="4 3"/>' +
        '<text x="'+(axp+sp/2)+'" y="'+(ayp+sp+15)+'" font-size="12" fill="'+farbe+'" text-anchor="middle">−'+b+'x</text>' +
        quadFeld(axp+sp, ayp+sp, 22, weich, " \u2212"+b2p) +
        '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">+'+b+'x und −'+b+'x heben sich auf — übrig: x² − '+b2p+'</text>' +
        '<text x="150" y="205" font-size="13" fill="'+farbe+'" text-anchor="middle">(a + b)(a − b) = a² − b²</text>' +
        '</svg>';
      ex.question = "(x + "+b+")(x − "+b+") = ? (Plus-Minus-Formel: (a + b)(a − b) = a² − b²)";
      ex.hint = "Plus-Minus-Formel: die Mittelstücke +"+b+"x und −"+b+"x heben sich auf.";
      ex.explanation = "(x + "+b+")(x − "+b+") = x² + "+b+"x − "+b+"x − "+b+"² = x² − "+b2p+".";
      ex.tips = ["Plus-Minus-Formel merken: (a + b)(a − b) = a² − b² — kein Mittelstück!"];
      options = [ergebnis, "x² + "+b2p, "x² − "+(2*b)+"x − "+b2p, "x² + "+(2*b)+"x + "+b2p];
    }
    options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
    while(options.length < 2){
      options.push(ergebnis + " ");
      options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
    }
    options = shuffle(options);
    ex.choices = options;
    ex.correctIndex = options.indexOf(ergebnis);
    ex.answer = ergebnis;
    ex.svg = svgHtml;
    ex.unit = "";
    ex.badge = badge;
    ex.badgeColor = farbe;
    return ex;
  }


  function bruchWort(z,n){
    var zN=["","ein","zwei","drei","vier","fünf","sechs","sieben","acht","neun","zehn"];
    var nN={2:"Hälfte",3:"Drittel",4:"Viertel",5:"Fünftel",6:"Sechstel",7:"Siebtel",8:"Achtel",9:"Neuntel",10:"Zehntel"};
    if(z===1&&n===2) return "die Hälfte";
    var w=nN[n]; if(!w) return z+"/"+n;
    return zN[z]+" "+w;
  }


  /* P1.22: Lineare Gleichungssysteme 2x2 — H2 (Einsetz-/Additionsverfahren, kindgerecht) */
  function genLineareGleichungssysteme(diff){
    diff = diff || 2;
    var farbe = COLORS.gleichung.main, weich = COLORS.gleichung.soft;
    var ex = baseEx("gleichung","gleichungssystem");
    ex.inputType = "mc";
    // Additionszweig zuerst wuerfeln, damit x/y passend gewaehlt werden koennen
    var willAddieren = (diff !== 1 && Math.random() >= 0.5);
    if(willAddieren){
      // Additionsverfahren: kx + b1*y = c1 und kx - b1*y = c2, beide c positiv.
      // Waehle k, x, y so, dass kx > b1*y (sonst waere c2 negativ).
      var k2 = diff===3 ? rand(2,4) : rand(1,3);
      var b1b = rand(1,2);
      x = diff===3 ? rand(3,9) : rand(2,6);
      y = diff===3 ? rand(1,4) : rand(1,3);
      while(k2*x - b1b*y < 1){ x++; if(x > 9){ x = 3; y = Math.max(1, y-1); } if(y < 1){ y = 1; b1b = 1; } }
      var a1b = k2, a2b = k2, c1b = a1b*x + b1b*y, c2b = a2b*x - b1b*y;
      var glAb = a1b+"x + "+b1b+"y = "+c1b, glBb = a2b+"x − "+b1b+"y = "+c2b;
      var ergB = "x = "+x+", y = "+y;
      var badgeB = "Gleichungssystem · Addieren";
      var svgB = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="30" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+glAb+'</text>' +
        '<text x="150" y="52" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+glBb+'</text>' +
        '<text x="150" y="82" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritt 1: Beide Gleichungen addieren</text>' +
        '<text x="150" y="102" font-size="13" fill="'+farbe+'" text-anchor="middle">+'+b1b+'y und −'+b1b+'y heben sich auf!</text>' +
        '<text x="150" y="122" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritt 2: x lösen, dann oben einsetzen</text>' +
        '<text x="150" y="152" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">x = ? und y = ?</text>' +
        '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Probe: beide Gleichungen müssen</text>' +
        '<text x="150" y="203" font-size="13" fill="'+farbe+'" text-anchor="middle">mit deiner Lösung stimmen!</text>' +
        '</svg>';
      ex.question = "Löse das Gleichungssystem: "+glAb+" und "+glBb+". (Additionsverfahren: addiere beide Gleichungen.)";
      ex.hint = "Addiere beide Gleichungen: +"+b1b+"y und −"+b1b+"y heben sich auf. Übrig: "+(a1b+a2b)+"x = "+(c1b+c2b)+".";
      ex.explanation = glAb+" + "+glBb+": "+(a1b+a2b)+"x = "+(c1b+c2b)+" ⇒ x = "+x+". In Gl1: "+b1b+"y = "+c1b+" − "+a1b+"·"+x+" = "+(c1b-a1b*x)+" ⇒ y = "+y+".";
      ex.tips = ["Additionsverfahren: Addiere beide Gleichungen, sodass eine Variable (hier y) wegfällt. Dann bleibt nur noch x übrig."];
      var optsB = [ergB, "x = "+x+", y = "+(y+1), "x = "+(x+1)+", y = "+y, "x = "+y+", y = "+x];
      optsB = optsB.filter(function(v,i,arr){return arr.indexOf(v)===i;});
      while(optsB.length < 2){ optsB.push(ergB + " "); optsB = optsB.filter(function(v,i,arr){return arr.indexOf(v)===i;}); }
      optsB = shuffle(optsB);
      ex.choices = optsB;
      ex.correctIndex = optsB.indexOf(ergB);
      ex.answer = ergB;
      ex.svg = svgB;
      ex.unit = "";
      ex.badge = badgeB;
      ex.badgeColor = farbe;
      return ex;
    }
    var x = diff===1 ? rand(1,4) : (diff===3 ? rand(2,9) : rand(1,6));
    var y = diff===1 ? rand(1,4) : (diff===3 ? rand(2,9) : rand(1,6));
    var a1, b1, c1, a2, b2, c2, verfahren;
    // Einsetzverfahren (immer kindgerecht: alle Zahlen positiv, y aus Gl1)
    {
      // Einsetzverfahren: eine Gleichung ist nach y aufgeloest
      verfahren = "einsetzen";
      a1 = rand(1,3); c1 = rand(1,5);
      b1 = 1;
      var t1 = a1*x + c1;
      a2 = rand(1,3); c2 = rand(1,5);
      b2 = 1;
      var t2 = a2*x + c2;
      y = t1; // y-Wert aus Gleichung 1 (x so gewaehlt, dass y positiv klein)
      // x so umrechnen, dass beide Gleichungen dieselbe Loesung (x,y) haben:
      // Gl1: y = a1*x + c1  =>  y fest; Gl2: y = a2*x + c2 muss dasselbe y geben.
      // Daher: c2 = y - a2*x (statt Zufall), falls positiv, sonst neu wuerfeln.
      c2 = y - a2*x;
      if(c2 < 1){ a2 = 1; c2 = y - x; }
      if(c2 < 1){ c2 = 1; y = a2*x + c2; }
      t2 = y;
      c1 = y - a1*x;
      if(c1 < 0){ c1 = 0; y = a1*x; c2 = y - a2*x; if(c2 < 0){ c2 = 0; } t2 = y; t1 = y; }
      c1 = t1 - a1*x; c2 = t2 - a2*x;
      b1 = 1; b2 = 1;
      var gl1 = "y = "+a1+"x + "+c1, gl2 = "y = "+a2+"x + "+c2;
      var ergebnis = "x = "+x+", y = "+y;
      var badge = "Gleichungssystem · Einsetzen";
      var svgHtml = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="150" y="30" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+gl1+'</text>' +
        '<text x="150" y="52" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">'+gl2+'</text>' +
        '<text x="150" y="82" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritt 1: Eine Gleichung steht schon da (y = …)</text>' +
        '<text x="150" y="102" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritt 2: In die andere einsetzen, x l\u00F6sen</text>' +
        '<text x="150" y="122" font-size="13" fill="'+farbe+'" text-anchor="middle">Schritt 3: x einsetzen \u2192 y berechnen</text>' +
        '<text x="150" y="152" font-size="15" fill="'+farbe+'" text-anchor="middle" font-weight="bold">x = ? und y = ?</text>' +
        '<text x="150" y="185" font-size="13" fill="'+farbe+'" text-anchor="middle">Beide Gleichungen m\u00FCssen mit</text>' +
        '<text x="150" y="203" font-size="13" fill="'+farbe+'" text-anchor="middle">deiner L\u00F6sung stimmen (Probe!)</text>' +
        '</svg>';
      ex.question = "Löse das Gleichungssystem: "+gl1+" und "+gl2+". (Einsetzverfahren: eine Gleichung ist schon nach y aufgelöst.)";
      ex.hint = "Setze "+gl1+" in die zweite Gleichung ein: "+a2+"x + "+c2+" = "+a1+"x + "+c1+". Löse nach x, dann y berechnen.";
      ex.explanation = gl1+" in Gl2: "+a1+"x + "+c1+" = "+a2+"x + "+c2+" ⇒ "+Math.abs(a1-a2)+"x = "+Math.abs(c2-c1)+" ⇒ x = "+x+". y = "+a1+"·"+x+" + "+c1+" = "+y+". Probe: "+a2+"·"+x+" + "+c2+" = "+(a2*x+c2)+". ✓";
      ex.tips = ["Einsetzverfahren: Nimm die Gleichung mit y = … und setze sie in die andere ein. Dann bleibt nur noch x übrig."];
      var options = [
        ergebnis,
        "x = "+x+", y = "+(y+1),
        "x = "+(x+1)+", y = "+y,
        "x = "+y+", y = "+x
      ];
      options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;});
      while(options.length < 2){ options.push(ergebnis + " "); options = options.filter(function(v,i,arr){return arr.indexOf(v)===i;}); }
      options = shuffle(options);
      ex.choices = options;
      ex.correctIndex = options.indexOf(ergebnis);
      ex.answer = ergebnis;
      ex.svg = svgHtml;
      ex.unit = "";
      ex.badge = badge;
      ex.badgeColor = farbe;
      return ex;
    }
  }

  function genTextaufgabeGarten(diff){
    diff = diff || 2;
    var l = diff===1?rand(3,9):(diff===3?rand(8,30):rand(5,18)), b = diff===1?rand(2,6):(diff===3?rand(5,22):rand(3,14));
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

  function genTextaufgabePizza(diff){
    diff = diff || 2;
    var n = diff===1?choice([4,6,8]):(diff===3?choice([10,12,16,20]):choice([6,8,10,12]));
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
  function genTextaufgabeWien(diff){
    diff = diff || 2;
    var stadt = choice(Object.keys(AUSTRIA.sehenswuerdigkeiten));
    var bauwerk = choice(AUSTRIA.sehenswuerdigkeiten[stadt]);
    var l = diff===1?rand(15,40):(diff===3?rand(40,150):rand(20,80));
    var b = diff===1?rand(8,20):(diff===3?rand(20,80):rand(10,40));
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
  function genTextaufgabeWandern(diff){
    diff = diff || 2;
    var start = rand(400, 1800);
    var hoehen = diff===1?rand(100,400):(diff===3?rand(500,1200):rand(150,900));
    var ziel = start + hoehen;
    var strecke = diff===1?rand(2,6):(diff===3?rand(6,18):rand(2,12));
    var ex = baseEx("textaufgabe","textaufgabe");
    var name1 = choice(AUSTRIA.vornamen);
    var name2 = choice(AUSTRIA.vornamen);
    var berg = choice(["Hochkönig","Großglockner","Dachstein","Rax","Schneeberg","Wilder Kaiser","Großer Priel"]);
    ex.question = name1+" und "+name2+" wandern in den "+berg+". Sie starten auf "+start+" m Seehöhe und erreichen das Gipfelkreuz auf "+ziel+" m Seehöhe. Sie wandern dafür "+strecke+" km. Wie viele Höhenmeter haben sie überwunden?";
    ex.hint = "Höhenmeter = Gipfelhöhe − Startshöhe. (Die Wanderstrecke in km ist hier nicht gefragt.)";
    ex.svg=austriaMapSVG({city:"Innsbruck", icon:"🥾", label:"Wandern", color:"#4A7FD6"});
    ex.badge="Alltag · Wandern"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m";
    ex.answer = hoehen;
    ex.explanation = "Höhenmeter = "+ziel+" m − "+start+" m = "+fmtAT(hoehen)+" m.";
    return ex;
  }

  // Einkauf: Preisberechnung mit Euro
  function genTextaufgabeEinkauf(diff){
    diff = diff || 2;
    var laden = choice(AUSTRIA.einkauf);
    var produkt = choice(AUSTRIA.lebensmittel);
    var einzel = (diff===1?rand(5,20):(diff===3?rand(30,90):rand(5,45))) / 10;
    var menge = diff===1?rand(1,3):(diff===3?rand(4,10):rand(2,6));
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
  function genTextaufgabeWeihnacht(diff){
    diff = diff || 2;
    var name = choice(AUSTRIA.vornamen);
    var p1 = (diff===1?rand(10,30):(diff===3?rand(40,95):rand(20,55))) / 10;
    var p2 = (diff===1?rand(6,18):(diff===3?rand(25,60):rand(10,35))) / 10;
    var p3 = (diff===1?rand(4,14):(diff===3?rand(15,40):rand(8,25))) / 10;
    var n1 = rand(1, 3);
    var n2 = rand(1, 2);
    var n3 = rand(1, 2);
    var sum = Math.round((p1*n1 + p2*n2 + p3*n3) * 100) / 100;
        var gegeben = choice([5, 10, 20]);  // realistische Scheine: 5€, 10€, 20€
    var rueckgeld = Math.round((gegeben - sum) * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    var geldNomen = (gegeben <= 10) ? "Münzen" : "-Schein";
    ex.question = name+" ist mit der Familie am Christkindlmarkt. "+name+" kauft "+n1+" Punsch zu je "+fmtEUR(p1)+", "+n2+" Lebkuchen zu je "+fmtEUR(p2)+" und "+n3+" Breze zu je "+fmtEUR(p3)+". "+name+" bezahlt mit "+fmtEUR(gegeben)+geldNomen+". Wie viel Wechselgeld bekommt "+name+" zurück?";
    ex.hint = "1) Gesamtkosten berechnen (alle Posten addieren). 2) Wechselgeld = Gegeben − Gesamtkosten.";
    ex.svg=austriaMapSVG({city:"Wien", icon:"🎄", label:"Weihnacht", color:"#D8495A"});
    ex.badge="Alltag · Christkindlmarkt"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="€"; ex.tolerance=0.01;
    ex.answer = rueckgeld;
    ex.explanation = "Gesamt: "+fmtEUR(p1*n1)+" + "+fmtEUR(p2*n2)+" + "+fmtEUR(p3*n3)+" = "+fmtEUR(sum)+". Wechselgeld: "+fmtEUR(gegeben)+" − "+fmtEUR(sum)+" = "+fmtEUR(rueckgeld)+".";
    return ex;
  }

  // Schule: Bruch-/Anteilsaufgabe aus dem Schulalltag
  function genTextaufgabeSchule(diff){
    diff = diff || 2;
    var schulTyp = choice(["Mittelschule","AHS-Unterstufe","Volksschule"]);
    var klassenGroesse = choice([20, 22, 24, 25, 26, 28]);
    var nenner = diff===1?choice([2,4,5]):(diff===3?choice([8,10]):choice([2, 4, 5, 8, 10]));
    var zaehler = rand(1, nenner-1);
    var anzahl = (klassenGroesse * zaehler) / nenner;
    if(anzahl !== Math.round(anzahl)) return genTextaufgabeSchule();
    var name = choice(AUSTRIA.vornamen);
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = "In einer "+klassenGroesse+"-köpfigen Klasse einer "+schulTyp+" haben "+zaehler+" von "+nenner+" Kindern die Mathematik-Schularbeit mit 'Sehr gut' oder 'Gut' bestanden. Wie viele Kinder sind das?";
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
  function genTextaufgabeSkikurs(diff){
    diff = diff || 2;
    var name = choice(AUSTRIA.vornamen);
    var ort = choice(["Schladming","Kitzbühel","Sölden","Mayrhofen","Zell am See","Ischgl","Saalbach"]);
    var basis = diff===1?choice([120,150,180]):(diff===3?choice([240,280,320,360]):choice([120, 150, 180, 200, 240, 280]));
    var rabatt = diff===1?choice([10,20]):(diff===3?choice([15,20,25,30]):choice([10, 15, 20, 25]));
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

  // Wandertag: Höhenmeter
  function genTextaufgabeWandertag(diff){
    diff = diff || 2;
    var name = choice(AUSTRIA.vornamen);
    var name2 = choice(AUSTRIA.vornamen);
    var berg = choice(["Rax","Schneeberg","Hochkönig","Dachstein","Großer Pyhrgas"]);
    var startHoehe = rand(700, 1400);
    var zielHoehe = startHoehe + (diff===1?rand(100,400):(diff===3?rand(500,1200):rand(300,800)));
    var hoehenmeter = zielHoehe - startHoehe;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" und "+name2+" wandern am Wandertag auf den "+berg+". Sie starten auf "+startHoehe+" m Seehöhe und erreichen den Gipfel auf "+zielHoehe+" m Seehöhe. Wie viele Höhenmeter überwinden sie?";
    ex.hint = "Höhenmeter = Gipfelhöhe − Starthöhe.";
    ex.svg=austriaMapSVG({city:"Graz", icon:"🏔️", label:"Wandertag", color:"#F2A93B"});
    ex.badge="Alltag · Wandertag"; ex.badgeColor=COLORS.textaufgabe.main;
    ex.inputType="number"; ex.unit="m"; ex.tolerance=10;
    ex.answer = hoehenmeter;
    ex.explanation = "Höhenmeter = "+zielHoehe+" m − "+startHoehe+" m = "+fmtAT(hoehenmeter)+" m.";
    return ex;
  }

  // Schulheft: Bruchteil + Preis (kombiniert)
  function genTextaufgabeSchulheft(diff){
    diff = diff || 2;
    var name = choice(AUSTRIA.vornamen);
    var produkt = choice(AUSTRIA.produkte);
    var preis = (diff===1?rand(10,40):(diff===3?rand(60,150):rand(20,80))) / 10; // 1,00 - 15,00 €
    var nenner = diff===1?choice([2,5]):(diff===3?choice([4,8,10]):choice([2, 4, 5, 10]));
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
  function genTextaufgabeEiscafe(diff){
    diff = diff || 2;
    var name = choice(AUSTRIA.vornamen);
    var kugelPreis = (diff===1?rand(12,20):(diff===3?rand(25,45):rand(15,30))) / 10; // 1,20 - 4,50 €
    var anzahlKugeln = diff===1?rand(2,3):(diff===3?rand(3,6):rand(2,4));
    var preisEis = Math.round(anzahlKugeln * kugelPreis * 100) / 100;
    var portionen = [3, 4, 5];
    var nenner = choice(portionen);
    var zaehler = rand(1, nenner-1);
    var rabatt = Math.round((preisEis * zaehler / nenner) * 100) / 100; // zaehler/nenner gratis
    var endpreis = Math.round((preisEis - rabatt) * 100) / 100;
    var ex = baseEx("textaufgabe","textaufgabe");
    ex.question = name+" geht in die Eisdiele und bestellt "+anzahlKugeln+" Kugeln Eis um je "+fmtEUR(kugelPreis)+". Die Eisdiele hat eine Aktion: Als Rabatt gibt es "+bruchWort(zaehler,nenner)+" des Preises. Wie viel bezahlt "+name+"?";
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
    pythagoras:           withCurriculum("pythagoras",            genPythagoras),
    kreisUmfang:          withCurriculum("kreisUmfang",           genKreisUmfang),
    kreisFlaeche:         withCurriculum("kreisFlaeche",          genKreisFlaeche),
    quaderVolumen:        withCurriculum("quaderVolumen",         genQuaderVolumen),
    wuerfelVolumen:       withCurriculum("wuerfelVolumen",        genWuerfelVolumen),
    zylinderVolumen:      withCurriculum("zylinderVolumen",       genZylinderVolumen),
    weitereKoerper:       withCurriculum("weitereKoerper",        genWeitereKoerper),
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
    indirekteProportionalitaet: withCurriculum("indirekteProportionalitaet", genIndirekteProportionalitaet),
    mehrstufig:          withCurriculum("mehrstufig",            genMehrstufig),
    ganzeZahlen:         withCurriculum("ganzeZahlen",           genGanzeZahlen),
    wahrscheinlichkeit:  withCurriculum("wahrscheinlichkeit",   genWahrscheinlichkeit),
    mittelwerte:        withCurriculum("mittelwerte",          genMittelwerte),
    einheiten:          withCurriculum("einheiten",            genEinheiten),
    potenzenWurzeln:    withCurriculum("potenzenWurzeln",      genPotenzenWurzeln),
    potenzenErweitert:   withCurriculum("potenzenErweitert",     genPotenzenErweitert),
    teilbarkeit:        withCurriculum("teilbarkeit",          genTeilbarkeit),
    termeDistributiv:   withCurriculum("termeDistributiv",     genTermeDistributiv),
    lineareGleichungssysteme: withCurriculum("lineareGleichungssysteme", genLineareGleichungssysteme),
    binomischeFormeln:  withCurriculum("binomischeFormeln",    genBinomischeFormeln),
    lineareFunktionen:  withCurriculum("lineareFunktionen",    genLineareFunktionen),
    kongruenzKonstruktionen: withCurriculum("kongruenzKonstruktionen", genKongruenzKonstruktionen)
  };

  var MODES = [
    {id:"alles", label:"🎲 Alles gemischt", group:null, pool:Object.keys(GEN)},
    {id:"dreieck", label:"🔺 Dreiecke", group:"Geometrie · H3", pool:["dreieckWinkel","dreieckUmfang","dreieckFlaeche","dreieckErkennen","eigenschaftenDreieck","pythagoras"]},
    {id:"viereck", label:"◻ Vierecke", group:"Geometrie · H3", pool:["viereckWinkel","viereckUmfang","rechteckFlaeche","parallelogrammFlaeche","trapezFlaeche","viereckErkennen","eigenschaftenViereck"]},
    {id:"winkel", label:"📐 Winkel", group:"Geometrie · H3", pool:["dreieckWinkel","viereckWinkel"]},
    {id:"umfang-flaeche", label:"📏 Umfang & Fläche", group:"Geometrie · H3", pool:["dreieckUmfang","viereckUmfang","dreieckFlaeche","rechteckFlaeche","parallelogrammFlaeche","trapezFlaeche"]},
    {id:"kreis", label:"⭕ Kreis", group:"Geometrie · H3", pool:["kreisUmfang","kreisFlaeche"]},
    {id:"koerper", label:"📦 Körper (Volumen)", group:"Geometrie · H3", pool:["quaderVolumen","wuerfelVolumen","zylinderVolumen","weitereKoerper"]},
    {id:"oberflaeche", label:"📊 Oberfläche von Körpern", group:"Geometrie · H3", pool:["quaderOberflaeche","wuerfelOberflaeche","zylinderOberflaeche"]},
    {id:"bruche", label:"➗ Brüche (alle Operationen)", group:"Zahlen & Operationen · H1", pool:["bruchKuerzen","bruchAddition","bruchAdditionVerschNenner","bruchVergleich","bruchMultiplikation","bruchDivision","gemischteZahlen","bruchDezimal"]},
    {id:"bruch-prozent", label:"➗ Brüche & Prozent", group:"Zahlen & Operationen · H1", pool:["bruchKuerzen","bruchAddition","bruchAdditionVerschNenner","bruchVergleich","bruchMultiplikation","bruchDivision","prozentVonZahl","prozentAnteil"]},
    {id:"prozent-zins", label:"💰 Prozente & Zinsen", group:"Zahlen & Operationen · H1", pool:["prozentVonZahl","prozentAnteil","zinsrechnung"]},
    {id:"textaufgaben", label:"📖 Textaufgaben", group:"Sachrechnen · I1", pool:["textaufgabeGarten","textaufgabePizza","textaufgabeSchulheft","textaufgabeEiscafe","textaufgabeSkikurs","textaufgabeWandertag","mehrstufig"]},
    {id:"alltag", label:"🇦🇹 Alltag in Österreich", group:"Sachrechnen · I1", pool:["textaufgabeWien","textaufgabeWandern","textaufgabeEinkauf","textaufgabeWeihnacht","textaufgabeSchule","textaufgabeSchulheft","textaufgabeEiscafe","textaufgabeSkikurs","textaufgabeWandertag","mehrstufig"]},
    {id:"gleichungen", label:"⚖️ Gleichungen & Verhältnisse", group:"Größen & Variablen · H2", pool:["gleichungEinfach","proportionalitaet","indirekteProportionalitaet","lineareGleichungssysteme"]},
    {id:"daten-diagramme", label:"📊 Daten & Diagramme", group:"Daten & Statistik · H4", pool:["tabelleLesen","diagrammBalken","wahrscheinlichkeit","mittelwerte"]},
    {id:"ganze-zahlen", label:"🔢 Ganze Zahlen", group:"Zahlen & Operationen · H1", pool:["ganzeZahlen"]},
    {id:"einheiten", label:"📐 Maße & Einheiten", group:"Zahlen & Operationen · H1", pool:["einheiten"]},
    {id:"potenzen-wurzeln", label:"⚡ Potenzen & Wurzeln", group:"Zahlen & Operationen · H1", pool:["potenzenWurzeln","potenzenErweitert"]},
    {id:"teilbarkeit", label:"➗ Teilbarkeit, Primzahlen, kgV/ggT", group:"Zahlen & Operationen · H1", pool:["teilbarkeit"]},
    {id:"terme", label:"🔤 Terme vereinfachen", group:"Größen & Variablen · H2", pool:["termeDistributiv","binomischeFormeln"]},
    {id:"funktionen", label:"📈 Lineare Funktionen", group:"Größen & Variablen · H2", pool:["lineareFunktionen"]},
    {id:"kongruenz", label:"🔗 Kongruenz & Konstruktionen", group:"Geometrie · H3", pool:["kongruenzKonstruktionen"]}
  ];

  /* Schulstufen-Zuordnung je Übungstyp (1.–4. Klasse Mittelschule) */
  var GRADE_TAGS = {
    dreieckWinkel:[2,3], viereckWinkel:[2,3], dreieckUmfang:[2,3], viereckUmfang:[2,3],
    dreieckFlaeche:[2,3], rechteckFlaeche:[2,3], parallelogrammFlaeche:[3], trapezFlaeche:[3],
    dreieckErkennen:[2,3], viereckErkennen:[2,3], eigenschaftenDreieck:[2,3], eigenschaftenViereck:[2,3],
    kreisUmfang:[3,4], kreisFlaeche:[3,4], pythagoras:[3,4],
    quaderVolumen:[2,3], wuerfelVolumen:[2,3], zylinderVolumen:[4], weitereKoerper:[3,4],
    quaderOberflaeche:[3,4], wuerfelOberflaeche:[2,3], zylinderOberflaeche:[4],
    bruchKuerzen:[1,2], bruchAddition:[1,2], bruchVergleich:[1,2],
    bruchAdditionVerschNenner:[2,3], bruchMultiplikation:[3,4], bruchDivision:[4],
    prozentVonZahl:[3,4], prozentAnteil:[3,4],
    textaufgabeGarten:[2,3], textaufgabePizza:[2,3],
    textaufgabeWien:[2,3], textaufgabeWandern:[2,3], textaufgabeEinkauf:[2,3],
    textaufgabeWeihnacht:[2,3], textaufgabeSchule:[2,3],
    textaufgabeSkikurs:[3,4], textaufgabeWandertag:[2,3], textaufgabeSchulheft:[2,3], textaufgabeEiscafe:[2,3],
    gleichungEinfach:[3,4], lineareGleichungssysteme:[4],
    tabelleLesen:[2,3],
    diagrammBalken:[2,3], gemischteZahlen:[1,2], bruchDezimal:[1,2],
    zinsrechnung:[3,4], proportionalitaet:[2,3], indirekteProportionalitaet:[3,4], mehrstufig:[2,3],
    ganzeZahlen:[1,2], wahrscheinlichkeit:[3,4], mittelwerte:[3,4], einheiten:[2,3,4], potenzenWurzeln:[3,4], potenzenErweitert:[3,4], teilbarkeit:[3,4], termeDistributiv:[3,4], binomischeFormeln:[3,4], lineareFunktionen:[3,4], kongruenzKonstruktionen:[3,4]
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
    pythagoras:           {codes:["H3.I2","I2.M1"], kompetenz:"Satz des Pythagoras im rechtwinkligen Dreieck anwenden"},
    kreisUmfang:          {codes:["H3.I3","I2.M1"], kompetenz:"Umfang eines Kreises berechnen (U = 2·π·r)"},
    kreisFlaeche:         {codes:["H3.I3","I2.M1"], kompetenz:"Flächeninhalt eines Kreises berechnen (A = π·r²)"},
    quaderVolumen:        {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Quaders berechnen"},
    wuerfelVolumen:       {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Würfels berechnen"},
    zylinderVolumen:      {codes:["H3.I4","I2.M1"], kompetenz:"Volumen eines Zylinders berechnen"},
    weitereKoerper:       {codes:["H3.I4","I2.M1"], kompetenz:"Volumen von Pyramide, Prisma, Kegel und Kugel berechnen"},
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
    indirekteProportionalitaet: {codes:["H2.I2"], kompetenz:"Indirekt proportionale Zusammenhänge anwenden (mehr Leute ⇒ weniger Zeit): Gesamtarbeit bestimmen und aufteilen"},
    mehrstufig:          {codes:["I1.M1","I2.M1"], kompetenz:"Mehrstufige Sachaufgaben in Teilschritten lösen"},
    ganzeZahlen:         {codes:["H1.I3","I2.M1"], kompetenz:"Mit ganzen und negativen Zahlen rechnen (Zahlenstrahl, Betrag, Temperatur)"},
    wahrscheinlichkeit:  {codes:["I3.M1"], kompetenz:"Einfache Wahrscheinlichkeiten bestimmen (günstige durch mögliche Fälle)"},
    mittelwerte:        {codes:["I3.M1"], kompetenz:"Mittelwert, Modus und Median einer Datenreihe bestimmen und interpretieren"},
    einheiten:          {codes:["H1.I3","I2.M1"], kompetenz:"Größen in unterschiedlichen Maßeinheiten umrechnen (Länge, Masse, Geld)"},
    potenzenWurzeln:   {codes:["H1.I1","H2.I2"], kompetenz:"Potenzen mit ganzzahligem Exponenten bilden und auswerten; Wurzeln ziehen (Quadrat-, Kubikwurzel)"},
teilbarkeit:       {codes:["H1.I1"], kompetenz:"Teilbarkeitsregeln anwenden; Primzahlen erkennen; kgV und ggT kleinerer Zahlen bestimmen"},
termeDistributiv:  {codes:["H2.I1"], kompetenz:"Terme vereinfachen und das Distributivgesetz anwenden: Klammern auflösen (a·(x±b)), gemeinsame Faktoren ausklammern (ax±ay) und gleiche Terme zusammenfassen (ax±bx)"},
    binomischeFormeln: {codes:["H2.I1"], kompetenz:"Binomische Formeln anwenden: Plus-Formel (a+b), Minus-Formel (a-b) und Plus-Minus-Formel (a+b)(a-b)"},
    potenzenErweitert: {codes:["H1.I1","H2.I2"], kompetenz:"Zehnerpotenzen und Gleitkommadarstellung anwenden; Potenzen mit negativen Exponenten als Kehrwert deuten"},
    lineareGleichungssysteme: {codes:["H2.I1"], kompetenz:"Lineare Gleichungssysteme 2x2 lösen (Einsetz- und Additionsverfahren) und die Lösung in beiden Gleichungen prüfen"},
    lineareFunktionen: {codes:["H2.I2"], kompetenz:"Lineare Funktionen y = m·x + t: Steigung m und y-Achsenabschnitt t aus Graph ablesen; Funktionsgleichung aufstellen"},
    kongruenzKonstruktionen: {codes:["H3.I2","H3.I5"], kompetenz:"Kongruenzsätze und Ähnlichkeit von Figuren anwenden"}
  };

  /* ============ P4.3: Spaced Repetition ============
   * Intervall-Leiter: falsch -> 10 Min -> 1 Tag -> 3 Tage -> 7 Tage -> 14 Tage -> gemastert.
   * Format je Key: [dueEpochSekunden, level 1..5]. Nur eine FAELLIGE richtige Antwort befoerdert. */
  var SPACED_STEPS = [600, 86400, 259200, 604800, 1209600];
  function spacedSanitize(spaced){
    var out = {};
    if(!spaced || typeof spaced !== "object") return out;
    var now = Math.floor(Date.now()/1000);
    for(var k in spaced){
      if(!Object.prototype.hasOwnProperty.call(spaced, k)) continue;
      if(!GEN[k]) continue;
      var e = spaced[k];
      if(!e || e.length !== 2) continue;
      var due = parseInt(e[0], 10), level = parseInt(e[1], 10);
      if(!isFinite(due) || !isFinite(level)) continue;
      level = Math.max(1, Math.min(SPACED_STEPS.length, level));
      if(due < now - SPACED_STEPS[SPACED_STEPS.length-1]) continue;
      out[k] = [due, level];
    }
    return out;
  }
  function spacedWrong(spaced, key, nowSec){
    var s = spacedSanitize(spaced);
    if(GEN[key]) s[key] = [nowSec + SPACED_STEPS[0], 1];
    return s;
  }
  function spacedCorrect(spaced, key, nowSec){
    var s = spacedSanitize(spaced);
    var e = s[key];
    if(!e || e[0] > nowSec) return s;
    var lvl = e[1] + 1;
    if(lvl > SPACED_STEPS.length){ delete s[key]; return s; }
    s[key] = [nowSec + SPACED_STEPS[lvl-1], lvl];
    return s;
  }
  function spacedDueKeys(spaced, nowSec, pool){
    var s = spacedSanitize(spaced), out = [];
    for(var k in s){
      if(s[k][0] <= nowSec && (!pool || pool.indexOf(k) !== -1)) out.push(k);
    }
    return out;
  }
  /* P4.3: Ampel je Übungsmodus — rot: ≥1 Leiter-Eintrag fällig | gelb: Einträge vorhanden, nichts fällig | grün: keine Einträge.
     Rote Moduse haben Vorrang bei der Aufgabenwahl (Prioritätsrunde). */
  function spacedAmpel(spaced, pool, nowSec){
    var s = spacedSanitize(spaced), rot = false, gelb = false;
    for(var k in s){
      if(pool && pool.indexOf(k) === -1) continue;
      if(s[k][0] <= nowSec) rot = true; else gelb = true;
      if(rot) break;
    }
    return rot ? "rot" : (gelb ? "gelb" : "gruen");
  }

  /* ============ P6: Eulenhain — endlose Stufen + Eulensammlung ============ */

  var RANG_TITEL = [
    "Geometrie-Lehrling", "Formen-Geselle", "Vierecks-Profi", "Dreiecks-Meister",
    "Geometrie-Meister/in", "Muster-Denker/in", "Zahlen-Forscher/in", "Eulen-Freund/in",
    "Rechen-Ass", "Mathe-Legende"
  ];
  function roman(n){
    var m = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],
             [40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    var out = "", i;
    for(i=0;i<m.length;i++){ while(n>=m[i][0]){ out+=m[i][1]; n-=m[i][0]; } }
    return out;
  }
  /* Stufe n braucht kumulativ 50*(n-1)*n Punkte: Stufe 2=100, 3=300, 4=600, 5=1000, 10=4500 … */
  function punkteFuerStufe(n){
    n = Math.max(1, Math.floor(n));
    return 50*(n-1)*n;
  }
  function stufeVonPunkten(p){
    if(!(p>0)) return 1;
    return Math.max(1, Math.floor((1 + Math.sqrt(1 + 2*p/25)) / 2));
  }
  function rangTitel(stufe){
    stufe = Math.max(1, Math.floor(stufe));
    var tier = Math.floor((stufe-1)/5);
    var extra = Math.max(0, tier - (RANG_TITEL.length-1));
    var base = RANG_TITEL[Math.min(tier, RANG_TITEL.length-1)];
    return extra>0 ? base+" "+roman(extra+1) : base;
  }

  /* Eulen: 12 kuratierte Farbwelten, danach Farbton-Rotation (unendlich viele). */
  var OWL_FARBEN = ["Rubin","Smaragd","Saphir","Bernstein","Ametyst","Jade","Topas","Mohn","Türkis","Lavendel","Zimt","Pflaume"];
  var OWL_ANIMS = ["flap","blink","bob","tilt","hop","sleep","spin","fluff"];
  function owlForLevel(n){
    n = Math.max(1, Math.floor(n));
    var idx = n - 1;
    var iteration = Math.floor(idx / OWL_FARBEN.length);
    var colorName = OWL_FARBEN[idx % OWL_FARBEN.length];
    return {
      stufe: n,
      name: colorName + "-Eule" + (iteration>0 ? " " + roman(iteration+1) : ""),
      colorName: colorName,
      hue: (idx*47 + 268) % 360, /* 268 = Lila-Ton der Logo-Eule */
      anim: OWL_ANIMS[idx % OWL_ANIMS.length]
    };
  }
  /* Eulen-Innenteile (ohne <svg>) — für den Baum des Eulenhains */
  function owlInner(hue){
    hue = ((hue % 360) + 360) % 360;
    var body = "hsl(" + hue + ",72%,62%)";
    var wing = "hsl(" + hue + ",66%,50%)";
    var belly = "hsl(" + hue + ",85%,93%)";
    var ear = "hsl(" + hue + ",58%,55%)";
    return '<g class="owl">'
      + '<ellipse class="owl-wing owl-wing-l" cx="19" cy="64" rx="12.5" ry="20" fill="'+wing+'"/>'
      + '<ellipse class="owl-wing owl-wing-r" cx="81" cy="64" rx="12.5" ry="20" fill="'+wing+'"/>'
      + '<ellipse class="owl-body" cx="50" cy="58" rx="30" ry="35" fill="'+body+'"/>'
      + '<ellipse class="owl-belly" cx="50" cy="73" rx="17" ry="14" fill="'+belly+'"/>'
      + '<path class="owl-ear owl-ear-l" d="M32 33 L35 22 L42 31 Z" fill="'+ear+'"/>'
      + '<path class="owl-ear owl-ear-r" d="M68 33 L65 22 L58 31 Z" fill="'+ear+'"/>'
      + '<circle class="owl-eye-ring" cx="38" cy="49" r="13.5" fill="#FFFFFF" stroke="#1F2E45" stroke-width="2.5"/>'
      + '<circle class="owl-eye-ring" cx="62" cy="49" r="13.5" fill="#FFFFFF" stroke="#1F2E45" stroke-width="2.5"/>'
      + '<circle class="owl-pupil" cx="38" cy="49" r="5.5" fill="#1F2E45"/>'
      + '<circle class="owl-pupil" cx="62" cy="49" r="5.5" fill="#1F2E45"/>'
      + '<path class="owl-beak" d="M43 56 L57 56 L50 66 Z" fill="#F2A93B" stroke="#1F2E45" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<path class="owl-foot owl-foot-l" d="M40 92 L50 92 L45 99 Z" fill="#F2A93B"/>'
      + '<path class="owl-foot owl-foot-r" d="M50 92 L60 92 L55 99 Z" fill="#F2A93B"/>'
      + '</g>';
  }
  /* Parametrische Eule in der Geometrie des Logos (app-active.js lädt logo.svg für den Header) */
  function owlSVG(opts){
    opts = opts || {};
    var hue = (typeof opts.hue === "number") ? opts.hue : 268;
    var size = (typeof opts.size === "number") ? Math.max(16, opts.size) : 56;
    var label = String(opts.label || "Eule").replace(/"/g, "");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 0 124 100" width="'+size+'" height="'+Math.round(size*100/124)+'" role="img" aria-label="'+label+'">'
      + owlInner(hue)
      + '</svg>';
  }

  /* ============ P4.2: Wöchentliche Ziele ============ */

  var WOCHENZIELE = [
    { id:"points",  icon:"🎯", label:"Sammle 50 Punkte",          ziel:50 },
    { id:"solved",  icon:"📚", label:"Löse 20 Aufgaben",          ziel:20 },
    /* P4.2: Wiederholungs-Ziel ist dynamisch — wächst mit jedem Fehler dieser Woche */
    { id:"repeats", icon:"🔁", label:"Schaffe deine Wiederholungen", ziel:0, dynamisch:true }
  ];
  /* ISO-Wochenschlüssel "YYYY-Wnn" (Montag = Wochenstart) */
  function wochenSchluessel(d){
    d = d || new Date();
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var tag = (t.getUTCDay() + 6) % 7; /* Mo=0 … So=6 */
    t.setUTCDate(t.getUTCDate() - tag + 3); /* Donnerstag dieser Woche */
    var ersterDonnerstag = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var ftag = (ersterDonnerstag.getUTCDay() + 6) % 7;
    ersterDonnerstag.setUTCDate(ersterDonnerstag.getUTCDate() - ftag + 3);
    var woche = 1 + Math.round((t - ersterDonnerstag) / (7*24*3600*1000));
    return t.getUTCFullYear() + "-W" + (woche < 10 ? "0" : "") + woche;
  }

  /* ============ P4.1: Wissensgarten — 6 Kompetenz-Bäume je Lehrplanbereich ============
   * Jeder Baum bündelt Generatoren zu einem Themenbereich. Die Färbung kommt aus der
   * Spaced-Repetition-Leiter (state.spaced): Level 0 = unberührt, 1-2 = im Bau,
   * 3-4 = sicher, 5 = gemeistert (golden), fällig = rot. Keine neuen Persistenzfelder. */
  var GARTEN_BEREICHE = [
    { id:"brueche",  icon:"🌰", name:"Zahlen-Baum",   thema:"Brüche",     untertitel:"Zahlen & Brüche (H1.I1, H1.I3)",  generatoren:["einheiten","ganzeZahlen","bruchKuerzen","bruchAddition","bruchAdditionVerschNenner","bruchVergleich","bruchMultiplikation","bruchDivision","gemischteZahlen","bruchDezimal","potenzenWurzeln","potenzenErweitert","teilbarkeit"] },
    { id:"prozente", icon:"🪙", name:"Prozent-Baum",  thema:"Prozente",   untertitel:"Prozente & Verhältnisse (H1.I2, H2.I2)", generatoren:["prozentVonZahl","prozentAnteil","zinsrechnung","proportionalitaet","indirekteProportionalitaet"] },
    { id:"formen",   icon:"📐", name:"Winkel-Baum",   thema:"Winkel",     untertitel:"Figuren & Winkel (H3.I1/I2/I5)", generatoren:["dreieckWinkel","viereckWinkel","dreieckErkennen","viereckErkennen","eigenschaftenDreieck","eigenschaftenViereck","kongruenzKonstruktionen"] },
    { id:"messen",   icon:"📏", name:"Flächen-Baum",  thema:"Maße",       untertitel:"Umfang, Fläche & Körper (H3.I3/I4)", generatoren:["dreieckUmfang","pythagoras","viereckUmfang","dreieckFlaeche","rechteckFlaeche","parallelogrammFlaeche","trapezFlaeche","kreisUmfang","kreisFlaeche","quaderVolumen","wuerfelVolumen","zylinderVolumen","weitereKoerper","quaderOberflaeche","wuerfelOberflaeche","zylinderOberflaeche"] },
    { id:"alltag",   icon:"🧺", name:"Alltags-Baum",  thema:"Sachaufgaben", untertitel:"Sachaufgaben aus dem Alltag (I1.M1)", generatoren:["textaufgabeGarten","textaufgabePizza","textaufgabeWien","textaufgabeWandern","textaufgabeEinkauf","textaufgabeWeihnacht","textaufgabeSchule","textaufgabeSkikurs","textaufgabeWandertag","textaufgabeSchulheft","textaufgabeEiscafe","mehrstufig"] },
    { id:"struktur", icon:"🔗", name:"Daten-Baum",    thema:"Gleichungen", untertitel:"Gleichungen & Daten (H2.I1, I3.M1)", generatoren:["gleichungEinfach","lineareGleichungssysteme","tabelleLesen","diagrammBalken","wahrscheinlichkeit","mittelwerte","termeDistributiv","binomischeFormeln","lineareFunktionen"] }
  ];
  function bereichFuerKey(key){
    var i;
    for(i = 0; i < GARTEN_BEREICHE.length; i++){
      if(GARTEN_BEREICHE[i].generatoren.indexOf(key) !== -1) return GARTEN_BEREICHE[i];
    }
    return null;
  }
  function gartenStatus(spaced, nowSec){
    var s = spacedSanitize(spaced || {});
    var baeume = GARTEN_BEREICHE.map(function(b){
      var tuffs = b.generatoren.map(function(k){
        var e = s[k];
        var cm = CURRICULUM_MAP[k];
        if(!e) return { key:k, name:(cm ? cm.kompetenz : k), status:"neu", level:0, due:false };
        var lvl = e[1];
        var due = e[0] <= nowSec;
        var st = due ? "due" : (lvl >= 5 ? "meister" : (lvl >= 3 ? "sicher" : "bau"));
        return { key:k, name:(cm ? cm.kompetenz : k), status:st, level:lvl, due:due };
      });
      var dueCount = 0, meister = 0, geuebt = 0, levelSum = 0;
      tuffs.forEach(function(t){
        if(t.due) dueCount++;
        if(t.status === "meister") meister++;
        if(t.level > 0) geuebt++;
        levelSum += Math.min(t.level, 5);
      });
      var pct = Math.round(100 * levelSum / (5 * tuffs.length));
      var status;
      if(meister === tuffs.length) status = "gold";
      else if(dueCount > 0) status = "rot";
      else if(geuebt === 0) status = "neu";
      else if(geuebt === tuffs.length && tuffs.every(function(t){ return t.level >= 3; })) status = "gruen";
      else status = "gelb";
      return { id:b.id, icon:b.icon, name:b.name, thema:b.thema, untertitel:b.untertitel, tuffs:tuffs, total:tuffs.length, dueCount:dueCount, meister:meister, geuebt:geuebt, pct:pct, status:status };
    });
    var pct = Math.round(baeume.reduce(function(a, b){ return a + b.pct; }, 0) / baeume.length);
    var goldene = baeume.filter(function(b){ return b.status === "gold"; }).length;
    return { baeume:baeume, pct:pct, goldene:goldene, total:baeume.length };
  }

  window.MB = {
    rand, randf, choice, shuffle, dist, mid, centroidOf, gcd, lcm, fmt, fmtAT, fmtEUR,
    normalizeAndScale, edgeLabelPos, vertexLabelPos, tickMarks, rightAngleMarker,
    polygonSVG, circleFigureSVG, boxFigureSVG, cylinderFigureSVG,
    fractionBarSVG, fractionFigureSVG, fractionPairFigureSVG, percentBarSVG,
    renderFigure, updateCurriculumBadge, openCurriculumModal, closeCurriculumModal,
    triangleFromSides, isValidTriangle, parallelogramFromSides, baseEx,
    COLORS, AUSTRIA, TRI_TEMPLATES, QUAD_TEMPLATES, QUAD_NAMES,
    TRI_STATEMENTS, QUAD_STATEMENTS, CURRICULUM_MAP, GEN, MODES, GRADES,
    GRADE_GROUPS, GRADE_TAGS, DIFFICULTIES, TIPP1_BY_TOPIC, deriveTips, bruchWort,
    SPACED_STEPS, spacedSanitize, spacedWrong, spacedCorrect, spacedDueKeys, spacedAmpel,
    punkteFuerStufe, stufeVonPunkten, rangTitel, owlForLevel, owlSVG, owlInner, OWL_ANIMS,
    WOCHENZIELE, wochenSchluessel, GARTEN_BEREICHE, gartenStatus, bereichFuerKey
  };
})();
