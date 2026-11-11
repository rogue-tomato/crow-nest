'use strict';
/* CROW NEST — the hex map's terrain, painted by the GPU at screen resolution.
   hexart.js computes smooth fields once per map (colours, masks, height slopes, distance from shore, a river distance field)
   at a low resolution; this shader thresholds and shades them per screen pixel, so shores, corals, rock plates and field
   seams stay crisp at every zoom, and rivers are water: they join lakes and seas with a smooth fillet.
   The canvas sits under the map's SVG (vectors, places, fog) and follows the same camera. WebGL 2; hexart.js falls back to a
   flat preview image without it. */
const HXGL={cv:null,gl:null,pr:null,u:{},cur:null,maps:new WeakMap()};
const HXGL_FS=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D T0,T1,T2,T3,T4,T5,T6,T7,T8,TH,TF,TN;
uniform int uOne; // always 1: loop bounds the compiler cannot unroll (Direct3D unrolled them into a 5 s compile)
uniform vec4 uFQ;uniform vec3 uCam;uniform vec2 uVP;uniform float uDpr;uniform vec4 uB;uniform vec2 uFS;uniform vec4 uHQ;uniform int uFlat;
out vec4 o;
const float SQ=1.7320508;
const ivec2 D[7]=ivec2[7](ivec2(0,0),ivec2(1,0),ivec2(1,-1),ivec2(0,-1),ivec2(-1,0),ivec2(-1,1),ivec2(0,1));
const vec3 FT[6]=vec3[6](vec3(204,172,78),vec3(190,160,68),vec3(212,184,94),vec3(180,156,70),vec3(196,176,98),vec3(170,158,84));
float sst(float a,float b,float v){float t=clamp((v-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
// the same integer value noise and mulberry32 as hexart.js, so CPU fields and GPU detail agree
float hn(int ix,int iy){uint h=uint(ix)*374761393u+uint(iy)*668265263u;h=(h^(h>>13u))*1274126177u;return float(h^(h>>16u))/4294967296.;}
// value noise from a 512² table of the same hash, one bilinear fetch at smoothstepped coordinates (same curve, a fraction of the code)
float vn(float x,float y){vec2 p=vec2(x,y),i=floor(p),f=p-i;f=f*f*(3.-2.*f);return textureLod(TN,(i+f+.5)/512.,0.).r;}
uint ms;float mr(){ms+=0x6D2B79F5u;uint t=(ms^(ms>>15u))*(1u|ms);t=(t+((t^(t>>7u))*(61u|t)))^t;return float(t^(t>>14u))/4294967296.;}
vec3 cell(float x,float y){x+=(vn(x*5.,y*5.)-.5)*.12;y+=(vn(x*5.+9.,y*5.)-.5)*.12;const float CS=.8;int gx=int(floor(x/CS)),gy=int(floor(y/CS));float d1=9.,d2=9.,c1=0.;
  for(int a=-1;a<=1*uOne;a++)for(int q=-1;q<=1*uOne;q++){ms=uint(gx+a)*92837111u^uint(gy+q)*689287499u;float sx=(float(gx+a)+mr())*CS,sy=(float(gy+q)+mr())*CS,dd=length(vec2(sx-x,sy-y));if(dd<d1){d2=d1;d1=dd;c1=mr();}else if(dd<d2)d2=dd;}
  return vec3(d1,d2,c1);}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
ivec2 axToOff(ivec2 a){return uFlat==1?ivec2(a.x,a.y+(a.x-(a.x&1))/2):ivec2(a.x+(a.y-(a.y&1))/2,a.y);}
vec2 offCtr(ivec2 o){return uFlat==1?vec2(1.5*float(o.x),SQ*(float(o.y)+.5*float(o.x&1))):vec2(SQ*(float(o.x)+.5*float(o.y&1)),1.5*float(o.y));}
ivec2 axRound(vec2 p){vec2 a=uFlat==1?vec2(2./3.*p.x,-p.x/3.+SQ/3.*p.y):vec2(SQ/3.*p.x-p.y/3.,2./3.*p.y);float x=a.x,z=a.y,y=-x-z,rx=floor(x+.5),ry=floor(y+.5),rz=floor(z+.5),dx=abs(rx-x),dy=abs(ry-y),dz=abs(rz-z);
  if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;return ivec2(int(rx),int(rz));}
vec4 hexAt(ivec2 o){ivec2 t=o-ivec2(uHQ.xy);if(t.x<0||t.y<0||t.x>=int(uHQ.z)||t.y>=int(uHQ.w))return vec4(0);return texelFetch(TH,t,0);}
float fogAt(ivec2 o){ivec2 t=o-ivec2(uFQ.xy);if(t.x<0||t.y<0||t.x>=int(uFQ.z)||t.y>=int(uFQ.w))return 0.;return texelFetch(TF,t,0).r*255.;}
float hexSD(vec2 p){p=abs(p);return uFlat==1?max(p.y,p.y*.5+p.x*.8660254)-.8660254:max(p.x,p.x*.5+p.y*.8660254)-.8660254;}
vec2 warp(vec2 p){return p+vec2(vn(p.x*.9+5.,p.y*.9)-.5,vn(p.x*.9,p.y*.9+8.)-.5)*.2+vec2(vn(p.x*2.2+2.,p.y*2.2)-.5,vn(p.x*2.2,p.y*2.2+3.)-.5)*.32+vec2(vn(p.x*5.+7.,p.y*5.)-.5,vn(p.x*5.,p.y*5.+1.)-.5)*.1;}
// tree crowns as Hexer draws them: puffy clusters of round lobes, each overlapping the one below-right with a darker crescent,
// a pale highlight towards the light, a soft shadow on the floor; one crown per jittered grid cell, only where the forest is
vec3 TB[4]=vec3[4](vec3(100,126,52),vec3(102,118,50),vec3(58,116,46),vec3(118,92,108));
vec4 trees(vec2 p,float fw,out float shadow){const float TC=.68;vec2 cc=floor(p/TC);float bestY=-1e9,cov=0.;vec3 col=vec3(0);shadow=0.;const vec2 SO=vec2(.09,.11);
  for(int i=-1;i<=1*uOne;i++)for(int j=-1;j<=1*uOne;j++){ivec2 id=ivec2(cc)+ivec2(i,j);ms=uint(id.x)*1597334677u^uint(id.y)*3812015801u^7u;
    vec2 ct=(vec2(id)+.5+(vec2(mr(),mr())-.5)*.8)*TC;float sz=mr(),R0=sz<.15?.09+sz*.4:.22+(sz-.15)*.22,tone=mr(),rot=mr()*6.283,skip=mr();
    if(length(p-ct)>R0*1.2+.12)continue;
    vec2 cu=(warp(ct)-uB.xy)/uB.zw;if(textureLod(T2,cu,0.).a<.56||textureLod(T4,cu,0.).b>.2)continue;
    vec4 l7=textureLod(T7,(ct-uB.xy)/uB.zw,0.);if(min(l7.r,min(l7.g,l7.b))/1.25-.3<R0*.7+.03)continue;
    float code=hexAt(axToOff(axRound(ct))).g*255.;int ty=code>6.5?3:code>5.5?2:code>4.5?1:0;if(skip<(ty==0?.25:ty==2?.0:.1))continue;
    float best=-1e9,bc=0.,bs=0.,bi=1.,uc=0.;vec2 bu=vec2(0),bl=vec2(0);float sc=0.;
    // a cloud of lobes: 8 uneven ones round the rim, 3 inside, one in the middle; lobes nearer the light are drawn last (on top)
    for(int k=0;k<12*uOne;k++){float fk=float(k),a=k<8?rot+fk*.7854+(hn(id.x*9+k,id.y*5)-.5)*.5:rot*1.7+fk*2.0944,rr=k<8?R0*(.52+.26*hn(id.x*17+k,id.y)):k<11?R0*.34:0.,
        lr=k<8?R0*(.3+.17*hn(id.x+k*3,id.y*7+1)):k<11?R0*.42:R0*.5;
      vec2 lc=ct+vec2(cos(a),sin(a))*rr;float d=length(p-lc)/lr,cv=1.-sst(1.-1.6*fw/lr,1.+1.6*fw/lr,d),key=-(lc.x+lc.y)*3.+(k<8?0.:R0);
      uc=max(uc,cv);if(cv>.5&&key>best){best=key;bc=cv;bu=(p-lc)/lr;bl=lc;bs=hn(id.x*5+k,id.y*3+2);bi=k<8?1.:.35;}
      sc=max(sc,1.-sst(.6,1.45,length(p-SO-lc)/lr));}
    if(bc>0.&&ct.y>bestY){bestY=ct.y;vec3 b=TB[ty]*(.88+.24*tone)*(.97+.06*bs);
      // soft painted light across the whole crown (yellower where lit, deeper green away from the light); lobe edges barely show
      vec2 rel=(p-ct)/R0;float lt=clamp(dot(rel,vec2(-.62,-.78))*.8,-1.,1.),cr=sst(.72,1.,length(bu-vec2(-.14,-.2)));
      vec3 cl=mix(b,b*vec3(1.26,1.14,.86)+vec3(14,6,0),max(0.,lt)*.75);cl=mix(cl,b*vec3(.74,.8,.78),max(0.,-lt)*.6);cl*=1.-cr*.16*bi;col=cl;cov=uc;}
    shadow=max(shadow,sc);}
  return vec4(col,cov);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
// marks Hexer also scatters, one candidate per jittered cell (the hex under it picks the kind): grass tufts, meadow flowers,
// savanna tussocks, marsh puddles, reeds and specks, reef foam; kept off water, forest, rock, roads and rivers; faded when tiny
vec3 marks(vec2 p,float fw,vec3 c){const float MC=.29;vec2 cc=floor(p/MC);float fade=1.-sst(.025,.05,fw);if(fade<=0.)return c;
  for(int i=-1;i<=1*uOne;i++)for(int j=-1;j<=1*uOne;j++){ivec2 id=ivec2(cc)+ivec2(i,j);ms=uint(id.x)*2654435761u^uint(id.y)*2246822519u^23505u;
    vec2 mp=(vec2(id)+.5+(vec2(mr(),mr())-.5)*.9)*MC,q=p-mp;float u=mr(),u2=mr(),u3=mr();if(dot(q,q)>.045)continue;
    float g=hexAt(axToOff(axRound(mp))).g*255.;int kind=0;
    if(abs(g-10.)<.5){if(u<.065)kind=1;}else if(abs(g-11.)<.5){kind=u<.097?1:u<.162?2:0;}else if(abs(g-12.)<.5){if(u<.032)kind=1;}
    else if(abs(g-13.)<.5){if(u<.065)kind=1;}else if(abs(g-14.)<.5){if(u<.95)kind=3;}
    else if(g>14.5&&g<16.5){float pd=g<15.5?.16:.03;kind=u<pd?4:u<pd+.097?1:u<pd+.29?5:0;}else if(abs(g-1.)<.5){if(u<.097)kind=6;}
    if(kind==0)continue;
    float cv=0.,op=.75,h2=fw*.5;vec3 mc=c*.62;
    if(kind==1){float s=(g>14.5?1.2:1.)*(1.+u3*.4),d=min(seg(q,vec2(-.035,0)*s,vec2(-.06,-.07)*s),min(seg(q,vec2(0),vec2(0,-.09)*s),seg(q,vec2(.035,0)*s,vec2(.06,-.07)*s)));cv=1.-sst(.012-h2,.012+h2,d);if(g>14.5)mc=vec3(61,74,44);}
    else if(kind==2){mc=u2<.6?vec3(180,207,224):vec3(238,232,214);op=.9;for(int k=0;k<4*uOne;k++){vec2 o2=(vec2(hn(id.x*4+k,id.y),hn(id.x,id.y*4+k))-.5)*vec2(.11,.09);cv=max(cv,1.-sst(.017-h2,.017+h2,length(q-o2)));}}
    else if(kind==3){cv=max(1.-sst(.02-h2,.02+h2,length(q-vec2(-.024,-.014))),max(1.-sst(.02-h2,.02+h2,length(q-vec2(.024,-.014))),1.-sst(.021-h2,.021+h2,length(q-vec2(0,.019)))));}
    else if(kind==4){float rx=.04+u3*.08,ry=rx*(.55+u2*.25),dd=(length(q/vec2(rx,ry))-1.)*ry;cv=1.-sst(-h2,h2,dd);mc=mix(vec3(91,90,54),vec3(54,53,31),(1.-sst(.008-h2,.008+h2,abs(dd)))*.85);op=.8;}
    else if(kind==5){cv=1.-sst(.012-h2,.012+h2,length(q));mc=vec3(69,68,42);op=.7;}
    else{float l=.1+u3*.08,d=9.;vec2 a=vec2(-l,0),b=vec2(0,-.06),e=vec2(l,0),pr=a;for(int k=1;k<=6*uOne;k++){float t=float(k)/6.;vec2 pt=mix(mix(a,b,t),mix(b,e,t),t);d=min(d,seg(q,pr,pt));pr=pt;}cv=1.-sst(.008-h2,.008+h2,d);mc=vec3(238,243,240);op=.55;}
    if(cv<=0.)continue;
    if(kind!=6){vec2 mu=(warp(mp)-uB.xy)/uB.zw;if(textureLod(T1,mu,0.).a>.35||textureLod(T2,mu,0.).a>.3||textureLod(T3,mu,0.).r>.5)continue;vec4 l7=textureLod(T7,(mp-uB.xy)/uB.zw,0.);if(min(l7.r,min(l7.g,l7.b))/1.25-.3<.03)continue;}
    c=mix(c,mc,cv*op*fade);}
  return c;}
// oasis (Hexer's look): a smooth rounded pool with a thin green rim, and a pale pinnate palm with a soft shadow beside it
vec4 oasis(vec2 p,ivec2 o,float fw,out float shadow){vec2 ce=offCtr(o);ms=uint(o.x)*2246822519u^uint(o.y)*3266489917u^8u;
  vec2 pc=ce+(vec2(mr(),mr())-.5)*.1;float R=.3+mr()*.05,ph=mr()*6.283,pa=mr()*6.283;
  // no pool where a road or river crosses the hex: then only the palm, as in Hexer
  vec4 l7=textureLod(T7,(pc-uB.xy)/uB.zw,0.);bool pool=min(l7.r,min(l7.g,l7.b))/1.25-.3>R+.06;vec2 q=p-pc;float th=atan(q.y,q.x),rr=R*(1.+.07*sin(3.*th+ph)+.04*sin(5.*th+ph*1.7));
  float sd=length(q*vec2(1.,1.12))-rr;vec3 col=vec3(0);float cov=0.;shadow=0.;
  if(pool&&sd<.045+fw){float rim=1.-sst(.035-fw,.035+fw,sd),wat=1.-sst(-fw,fw,sd);col=mix(vec3(122,156,78),vec3(90,126,166)*(1.+(vn(p.x*6.,p.y*6.)-.5)*.1),wat);col=mix(col,vec3(140,176,198),wat*(1.-sst(.0,.05,-sd))*.35);cov=rim;}
  // palm: seven arching fronds with leaflets, lit side yellow-green
  const float PL=.25;vec2 pp=ce;bool palm=false;
  // the palm stands beside the pool (or in the hex) where no road or river passes: six spots are tried, else no palm
  for(int k=0;k<6*uOne;k++){float a=pa+float(k)*1.0472;vec2 c2=pool?pc+vec2(cos(a),sin(a))*(R+.16):ce+vec2(cos(a),sin(a))*.4;vec4 m7=textureLod(T7,(c2-uB.xy)/uB.zw,0.);if(min(m7.r,min(m7.g,m7.b))/1.25-.3>.14){pp=c2;palm=true;break;}}
  for(int s2=0;s2<2*uOne;s2++){if(!palm)break;vec2 d=p-pp-(s2==0?vec2(.05,.06):vec2(0));float rho=length(d);if(rho>PL*1.05)continue;float best=0.,lit=0.,mid=0.;
    for(int k=0;k<9*uOne;k++){float a=pa*1.3+float(k)*.6981+(hn(o.x*7+k,o.y)-.5)*.45,fl=PL*(.82+.18*hn(o.x+k*5,o.y*3)),al=dot(d,vec2(cos(a),sin(a))),ac=dot(d,vec2(-sin(a),cos(a)))-.3*al*al/fl;float t=al/fl;
      if(t<=0.||t>=1.)continue;float w=fl*.21*sin(3.1416*pow(t,.65))*(.35+.85*pow(abs(sin(t*34.+float(k))),.6)),cv=1.-sst(w-fw,w+fw,abs(ac));if(cv>best){best=cv;lit=dot(vec2(cos(a),sin(a)),vec2(-.67,-.74));mid=1.-sst(.004,.012,abs(ac));}}
    if(s2==0)shadow=max(shadow,best*.5);
    else if(best>0.){vec3 pcl=mix(vec3(92,140,52),vec3(176,198,92),.5+.5*lit);pcl=mix(pcl,pcl*1.18,mid*.6);col=mix(col,pcl,best);cov=max(cov,best);}}
  return vec4(col,cov);}
void main(){
  float fw=1./(uCam.z*uDpr);vec2 wp=vec2(uCam.x+(gl_FragCoord.x-uVP.x*.5)*fw,uCam.y-(gl_FragCoord.y-uVP.y*.5)*fw);
  // only the map's own hexes, antialiased along the outer edge
  ivec2 ax=axRound(wp),h0=axToOff(ax);float al=0.,ap=0.,gc=hexAt(h0).g*255.,fg=fogAt(h0);bool reef=false,mkz=false;
  for(int i=0;i<7*uOne;i++){ivec2 h2=axToOff(ax+D[i]);vec4 h=hexAt(h2);float cv=clamp(.5-hexSD(wp-offCtr(h2))/fw,0.,1.);
    if(h.r<.5){if(fogAt(h2)>1.5)ap=max(ap,cv);continue;}al=max(al,cv);float g=h.g*255.;if(abs(g-1.)<.5)reef=true;if(g>9.5||abs(g-1.)<.5)mkz=true;}
  // players' fog: plain paper over cells nobody has seen yet, with the grid line
  vec4 paper=vec4(0);if(ap>0.){float d=-hexSD(wp-offCtr(h0));paper=vec4(mix(vec3(216,204,174),vec3(201,187,152),clamp((.015-d)/fw+.5,0.,1.))/255.*ap,ap);}
  if(al<=0.){o=paper;return;}
  // every terrain border wobbles (two octaves of noise bend where the fields are read), like Hexer's border wobble
  vec2 wq=warp(wp);
  vec2 uv=(wq-uB.xy)/uB.zw;vec4 f0=textureLod(T0,uv,0.),f1=textureLod(T1,uv,0.),f2=textureLod(T2,uv,0.),f3=textureLod(T3,uv,0.),f4=textureLod(T4,uv,0.),f5=textureLod(T5,uv,0.),f6=textureLod(T6,uv,0.),f7=textureLod(T7,(wp-uB.xy)/uB.zw,0.),f8=textureLod(T8,uv,0.); // rivers and roads are read unbent
 
  float x=wp.x,y=wp.y,farm=f0.a,wraw=f1.a,fraw=f2.a,mtn=f3.r,crg=f3.g,badm=f3.b,halo=f3.a,sandM=f4.r,snowM=f4.g,poiM=f4.b,hil=f4.a,h=f5.r*1.25,dist=f5.a*3.,rs=f7.r/1.25-.3;
  vec2 hg=(f5.gb-.5)*8.,sg=(f6.rg-.5)*8.,ig=(f6.ba-.5)*8.;
  vec3 c=f0.rgb*255.;const vec3 L=vec3(-.6,-.66,.45);float LN=length(L),flt=L.z/LN;
  // sand ripples, tundra drifts, badland mottling
  if(sandM>.02||badm>.02||snowM>.02){float wv=vn(x*.7,y*.7)*3.,mo=vn(x*.9+31.,y*.9)-.5,fd=sst(.25,.65,vn(x*.45+7.,y*.45-3.)),k=1.;
    for(int s=0;s<2*uOne;s++){float m=s==0?sandM:snowM;if(m<=.02)continue;float f=s==0?2.2:1.4,pw=s==0?8.:3.,ph=(x*.5+y*.8)*f+wv,cc=pow(max(0.,sin(ph*6.283)),pw),dd=pow(max(0.,sin((ph-.12)*6.283)),pw*.5),
      br=sst(.3,.62,vn((x*.8-y*.5)*1.4,ph*.9)),rp=(cc*.11-dd*.075)*br*fd;k+=s==0?m*(rp+mo*.05):m*(rp*2.2+mo*.04);}
    k+=badm*(mo*.16+(vn(x*2.3-5.,y*2.3)-.5)*.08);c*=k;}
  if(h>.004){vec2 nn=-mix(hg,sg,.7)*(2./3.); // mostly the smoothed slope: broad lit and shaded planes, as in Hexer, not busy bumps
   float sh=dot(vec3(nn,1.),L)/length(vec3(nn,1.))/LN/flt,mw=sst(.3,.5,mtn+(vn(x*9.,y*9.)-.5)*.14);
    if(mw>.01){float t=min(1.,h/1.1);vec3 ramp=t<.5?vec3(96.+50.*t,84.+44.*t,68.+38.*t):vec3(121.+150.*(t-.5),106.+140.*(t-.5),87.+124.*(t-.5));c=mix(c,ramp,mw);}
    c*=1.+(clamp(sh,.4,1.5)-1.)*min(1.25,mtn*1.5+badm*.9);
    // painted rock: crisp pale lit planes and darker shadow planes, brush streaks running down the slope
    if(mw>.05){float gl=length(sg);vec2 u=gl>1e-6?sg/gl:vec2(1,0);float sn=0.,sw0=0.;
      for(int k=0;k<3*uOne;k++){float ca=k==0?1.:k==1?.5:-.5,sa=k==0?0.:.866,dd=u.x*ca+u.y*sa,wk=dd*dd*dd*dd+.02;sn+=wk*vn((x*ca+y*sa)*1.1+13.*float(k),(-x*sa+y*ca)*6.5);sw0+=wk;}
      float sw=sst(.04,.16,gl),stv=(sn/sw0-.5)*sw+(vn(x*3.1,y*3.1)-.5)*(1.-sw),nz=(vn(x*2.6,y*2.6)-.5)*.2+stv*.34,hp=sst(.6,.95,h),lt=sst(.05,.16,sh-1.17+hp*.12+nz)*mw,dk=sst(.06,.2,.84-sh+nz*.7)*mw;
      c=mix(c,mix(vec3(206,196,180),vec3(240,222,200),sst(.6,.95,h)),lt*mix(.45,.75,sst(.6,.95,h)));c*=vec3(1.-dk*.14,1.-dk*.14,1.-dk*.12);c*=1.+stv*.08*mw;
      // fine brush hairs down the slope (Hexer's rock texture): long thin strokes, lighter on lit faces, darker in shade
      vec2 v2=vec2(-u.y,u.x);float al2=dot(wp,u),ac2=dot(wp,v2),hair=vn(al2*1.6,ac2*13.)-.5+(vn(al2*3.+4.,ac2*26.)-.5)*.15;c*=1.+hair*.07*mw*sw*(1.-sst(.03,.06,fw));
      // snow-pale peaks (Hexer's mountain-peak): a crisp cream patch, its edge torn into dark fragments
      // snow on the high crests of a range as well as on peak hexes
      float pn=max(f8.r*.9,sst(.9,1.2,h)*.85)+(sh-1.)*.3+(vn(x*6.,y*6.)-.5)*.16-sst(.5,.68,vn(x*1.7+5.,y*1.7-2.)*.65+vn(x*5.,y*5.)*.35)*.3-sst(.15,.4,gl)*sst(.95,.75,sh)*.25+(vn(x*16.,y*16.)-.5)*.06,hole=sst(.56,.6,vn(x*4.5,y*4.5)*.6+vn(x*12.,y*12.)*.4)*(1.-sst(.5,.72,pn)),
        pw=sst(.5-fw*3.,.5+fw*3.,pn)*mw*(1.-hole);
      // lit faces cream, faces turned from the light grey with darker brush hairs
      float lf=sst(.78,1.12,sh+stv*.25);vec3 pc=mix(vec3(178,178,174)*(1.+hair*.2),vec3(246,242,234)*(1.+hair*.05),lf); // snow: near white on lit faces, cool grey in shade
      c=mix(c,pc,pw);
      // torn dark fragments where the rock meets the lowland
      float edg=sst(.25,.38,mtn)*(1.-sst(.5,.7,mtn)),frg=sst(.58,.63,vn(x*3.5,y*3.5)*.7+vn(x*11.,y*11.)*.3);c=mix(c,vec3(96,82,64),edg*frg*.8);}
    if(crg>.05){vec3 a=cell(x,y),b2=cell(x-.05,y-.06);float on=a.z<.14?1.:0.,edge=on*(1.-sst(.02,.045,a.y-a.x)),shd=(b2.z<.27&&on<.5)?1.:0.;
      c=mix(c,vec3(156,146,128),on*crg);c*=1.-max(edge*.55,shd*.45)*crg;}}
  // hills: one broad dome per hex, its whole upper-left half lit and its lower-right half in shade (by slope direction)
  if(hil>.02){float gm=length(ig),fc=gm>1e-4?dot(-ig/gm,vec2(-.673,-.74)):0.,on=sst(.04,.3,gm)*hil;
    float lt=min(.75,on*1.*sst(-.35,.45,fc)),dk=min(.75,on*1.1*sst(.1,.45,-fc));c=mix(c,vec3(210,206,132),lt);c=mix(c,vec3(104,104,56),dk);}
  // farmland: Voronoi fields with thin darker seams and furrows (furrows fade out before they would shimmer)
  if(farm>.02){const float FS=.95;int gx=int(floor(x/FS)),gy=int(floor(y/FS));float d1=9.,d2=9.,c1=0.;
    for(int a=-1;a<=1*uOne;a++)for(int q=-1;q<=1*uOne;q++){ms=uint(gx+a)*73856093u^uint(gy+q)*19349663u;float sx=(float(gx+a)+.15+mr()*.7)*FS,sy=(float(gy+q)+.15+mr()*.7)*FS,s3=mr(),dd=(sx-x)*(sx-x)+(sy-y)*(sy-y);if(dd<d1){d2=d1;d1=dd;c1=s3;}else if(dd<d2)d2=dd;}
    float e=sqrt(d2)-sqrt(d1),an=c1*9.1,fu=c1<.5?.04*(.5+.5*sin((x*cos(an)+y*sin(an))*44.))*(1.-sst(.02,.04,fw)):0.,seam=1.-.18*(1.-sst(max(.012,fw*.7),max(.03,fw*1.8),e))-fu;
    c=mix(c,FT[min(5,int(c1*6.))]*seam,farm);}
  c=mix(c,vec3(66,122,44),min(.85,max(0.,halo*1.5-fraw*1.2)*.85));
  float fa=sst(.4,.56,fraw)*(1.-poiM);if(fa>0.)c=mix(c,f2.rgb*255.*(1.-sst(.6,1.,fraw)*.1),fa);
  if(abs(gc-8.)<.5){float so;vec4 oa=oasis(wp,axToOff(ax),fw,so);c*=1.-so*.4;c=mix(c,oa.rgb,oa.a);}
  // water: lakes and seas (blurred mask → signed distance near the shore) merged with rivers (a distance field) by a smooth union
  float sdl=.25;if(wraw>.002){float gw=2.;if(wraw<.998){vec2 tx=1./uFS;gw=max(2.,length(vec2(textureLod(T1,uv+vec2(tx.x,0),0.).a-textureLod(T1,uv-vec2(tx.x,0),0.).a,textureLod(T1,uv+vec2(0,tx.y),0.).a-textureLod(T1,uv-vec2(0,tx.y),0.).a))*uFS.x/uB.z*.5);}sdl=clamp((.5-wraw)/gw,-.25,.25)+(vn(x*6.,y*6.)-.5)*.06+(vn(x*15.,y*15.)-.5)*.025;}
  float rc=f7.a/1.25-.3+(vn(x*5.,y*5.)-.5)*.04,sdr=rs+(vn(x*4.,y*4.)-.5)*.03,sd=smin(smin(sdl,sdr,.09),rc,.09),wa=1.-sst(-fw,fw,sd);
  if(wa>0.){vec3 wc=mix(vec3(91,118,113),f1.rgb*255.,max(sst(.3,.7,wraw),sst(.03,-.03,rc-sdr))); /* delta channels are dark open water */float dd=max(-sd,dist),e=max(.012,fw),dn=dd+(vn(x*2.2,y*2.2)-.5)*.14,rw=max(.02,fw*1.5);
    // seas: stepped shelf bands with faint contours; lakes and ponds: one soft pale rim and cloudy water, as in Hexer
    bool lk=gc>2.5&&gc<3.5;float lift=lk?.42*(1.-sst(.03,.5,dn)):.4*(1.-sst(.2-e,.2+e,dn))+.26*(sst(.2-e,.2+e,dn)-sst(.4-e,.4+e,dn))+.13*(sst(.4-e,.4+e,dn)-sst(.64-e,.64+e,dn));
    float ring=lk?0.:max(0.,1.-abs(dn-.2)/rw)+max(0.,1.-abs(dn-.4)/rw)+max(0.,1.-abs(dn-.64)/rw);
    if(lift>0.)wc=mix(wc,lk?vec3(150,180,196):vec3(168,198,218),lift);else wc*=1.+lift;wc*=1.-.05*min(1.,ring);
    wc=mix(wc,vec3(46,76,102),sst(.02,.07,-sd)*sst(.03,-.03,rc-min(sdr,sdl))); // delta channels: dark open water with a pale rim
    wc*=1.+((vn(x*1.6+3.,y*1.6)-.5)*.14+(vn(x*4.5,y*4.5)-.5)*.06)*sst(.3,.7,wraw); // cloudy, uneven water
    // reef corals: six soft-edged heads per reef hex, rosy with a darker core
    if(reef){float cm=0.,core=0.,halo2=0.;for(int i=0;i<7*uOne;i++){ivec2 h2=axToOff(ax+D[i]);if(abs(hexAt(h2).g*255.-1.)>.5)continue;vec2 ce=offCtr(h2);ms=uint(h2.x)*2654435761u^uint(h2.y)*40503u^40503u;
      for(int k=0;k<4*uOne;k++){float a=mr()*6.283,d=sqrt(mr())*.55,s0=.15+mr()*.13,as=.75+mr()*.4,rt=mr()*6.283;vec2 q=wp-ce-vec2(cos(a),sin(a))*d;q=mat2(cos(rt),sin(rt),-sin(rt),cos(rt))*q;
        float ee=length(q/vec2(s0,s0*as))*(1.+.5*(vn(q.x*7.+float(k)*5.3,q.y*7.)-.5)+.12*(vn(q.x*20.,q.y*20.+float(k))-.5));cm=max(cm,1.-sst(.92-fw/s0,1.+fw/s0,ee));core=max(core,1.-sst(.2,.9,ee));halo2=max(halo2,1.-sst(.9,1.35,ee));}}
      wc=mix(wc,vec3(150,124,130),halo2*.3);wc=mix(wc,vec3(132,86,94),cm*.75);wc=mix(wc,vec3(106,62,70),core*.4);}
    c=mix(c,wc,wa);}
  c=mix(c,vec3(48,56,58),(1.-sst(.012,.012+fw*1.3,abs(sd)))*.78); // thin dark shoreline round lakes, seas and rivers
  if(halo>.03||fraw>.03){float sh3;vec4 tr=trees(wp,fw,sh3);c*=1.-sh3*.38;c=mix(c,tr.rgb,tr.a);}
  // roads: brown bands that let the ground show through, with grain and rough edges; trails flatter and more opaque
  float rn=(vn(x*7.,y*7.)-.5)*.03+(vn(x*19.,y*19.)-.5)*.014,rp=f7.g/1.25-.3+rn,rt=f7.b/1.25-.3+rn,gr=(vn(x*23.,y*23.)-.5)*.16+(vn(x*6.,y*6.)-.5)*.1;
  if(rp<fw){float a=1.-sst(-fw,fw,rp);c=mix(c,mix(c,vec3(120,75,48),.6)*(1.+gr)*(1.-.14*(1.-sst(0.,.035,-rp))),a*.95);}
  if(rt<fw){float a=1.-sst(-fw,fw,rt);c=mix(c,mix(c,vec3(137,94,64),.85)*(1.+gr*.7),a*.95);}
  if(mkz)c=marks(wp,fw,c);
  // thin hex grid on top, then the Ref's dimming of hexes the party has not seen
  c=mix(c,vec3(196,176,134),.42*clamp((.015+hexSD(wp-offCtr(h0)))/fw+.5,0.,1.));if(fg>.5&&fg<1.5)c=mix(c,vec3(18,16,14),.3);
  o=vec4(clamp(c/255.,0.,1.)*al,al);o=paper+o*(1.-paper.a);}`;
// WebGL 2 expected to work (not known to have failed): cheap, makes no context, so a tab click never waits on the GPU
const hxGLOK=()=>HXGL.gl!==false&&typeof WebGL2RenderingContext!=='undefined';
// The context is made at once; the shader (a few seconds of Direct3D compiling on a cold start) is compiled in the background
// with KHR_parallel_shader_compile, started soon after the page loads, so opening the map never waits on it. Until HXGL.ready
// the stage shows "Painting the map…"; when it is ready the app renders again.
function hxGLInit(){if(HXGL.gl!==null)return HXGL.gl;HXGL.gl=false;
  try{const cv=document.createElement('canvas');cv.className='hxgl';cv.setAttribute('aria-hidden','true');
    const gl=cv.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl)return false;
    // every query that waits for an answer from the GPU comes before the shader is sent: after it, Firefox would answer only
    // once the whole compile is done (seconds of frozen page)
    const pc=gl.getExtension('KHR_parallel_shader_compile'),ri=gl.getExtension('WEBGL_debug_renderer_info'),rn=ri?String(gl.getParameter(ri.UNMASKED_RENDERER_WEBGL)):'';
    HXGL.max=gl.getParameter(gl.MAX_TEXTURE_SIZE);HXGL.cost=/swiftshader|llvmpipe|software|basic render|softpipe/i.test(rn)?100:1;
    const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x};
    const vs=sh(gl.VERTEX_SHADER,'#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'),fs=sh(gl.FRAGMENT_SHADER,HXGL_FS),pr=gl.createProgram();
    gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);HXGL.t0=performance.now();
    // ponytail: a lost context (GPU reset) leaves the map blank until the page reloads; rebuild on webglcontextrestored if it ever matters
    cv.addEventListener('webglcontextlost',e=>e.preventDefault());
    HXGL.cv=cv;HXGL.pr=pr;HXGL.gl=gl;
    const finish=()=>{if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){console.warn('hex map: WebGL 2 terrain off —',gl.getShaderInfoLog(fs)||gl.getProgramInfoLog(pr));
        HXGL.gl=false;HXGL.cv=null;if(typeof hxForget==='function')hxForget();if(typeof render==='function')render();return}
      gl.useProgram(pr);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      for(const n of ['uCam','uVP','uDpr','uB','uFS','uHQ','uFlat','uFQ','uOne'])HXGL.u[n]=gl.getUniformLocation(pr,n);
      ['T0','T1','T2','T3','T4','T5','T6','T7','T8','TH','TF','TN'].forEach((n,i)=>gl.uniform1i(gl.getUniformLocation(pr,n),i));
      // the noise table behind vn(): the same integer hash as hexart.js, read with hardware filtering
      const nd=new Uint8Array(512*512*4);for(let y=0;y<512;y++)for(let x=0;x<512;x++)nd[(y*512+x)*4]=Math.round(hxN(x,y)*255);
      HXGL.noise=hxGLTex(512,512,nd,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      HXGL.ready=true;if(typeof hxGLReady==='function')hxGLReady()};
    // never ask for the link status before the compile is done (that call would wait for it on the main thread): Chrome reports
    // completion through KHR_parallel_shader_compile; elsewhere (Firefox) a fence after the link signals when the GPU got past it
    if(pc){const poll=()=>gl.getProgramParameter(pr,pc.COMPLETION_STATUS_KHR)?finish():setTimeout(poll,40);poll()}
    else{const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const poll=()=>gl.getSyncParameter(fence,gl.SYNC_STATUS)===gl.SIGNALED?(gl.deleteSync(fence),finish()):setTimeout(poll,40);poll()}
  }catch(e){console.warn('hex map: WebGL 2 terrain off —',e.message);HXGL.gl=false}
  return HXGL.gl}
// nothing runs at page load: the map's WebGL context, shader and painting start only when its tab is opened
function hxGLTex(w,h,data,lin){const gl=HXGL.gl,x=gl.createTexture();gl.activeTexture(gl.TEXTURE0+15);gl.bindTexture(gl.TEXTURE_2D,x);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  const f=lin?gl.LINEAR:gl.NEAREST;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return x}
// upload a map's fields (from hexart.js) once. A few maps keep their GPU textures — the Ref's map and the players' view switch
// back and forth; the oldest beyond that is dropped whole (its fields were freed after upload) and painted again when shown.
// (Deleting the previous map's textures on every switch left it marked uploaded with dead textures: a blank map on return.)
const HXGL_KEEP=3;
function hxGLUse(t){const gl=HXGL.gl,F=HXGL.maps.get(t);if(!gl)return null;if(HXGL.cur?.t===t)return HXGL.cur;if(F?.up!==2)return null;
  const res=HXGL.res||(HXGL.res=[]),i=res.indexOf(t);if(i>=0)res.splice(i,1);res.push(t);
  while(res.length>HXGL_KEEP){const old=res.shift(),O=HXGL.maps.get(old);if(O?.tex)for(const x of O.tex)gl.deleteTexture(x);HXGL.maps.delete(old);
    if(typeof HX_PC!=='undefined'){HX_PC.delete(old);HX_JOB.delete(old)}}
  HXGL.cur={t,F,tex:F.tex};return HXGL.cur}
// a painted map's fields go to the GPU only once the shader is ready, one texture per slice, so no upload waits behind the compile
function hxGLUpload(t,done){const F=HXGL.maps.get(t);if(!F||F.up)return;F.up=1;const list=[...F.data.map(d=>[F.cw,F.ch,d,true]),[F.hex.nq,F.hex.nr,F.hex.data,false]],tex=[];
  const step=()=>{const a=list.shift();tex.push(hxGLTex(...a));if(list.length)return setTimeout(step,0);F.tex=tex;F.data=null;F.hex.data=null;F.up=2;done?.()};setTimeout(step,0)}
// fog cells (set by hxSVG in hexmap.js) as a small per-hex texture, rebuilt only when they change
function hxGLFog(){const f=HXGL.fog||{kind:0,keys:[]},sig=f.kind+':'+f.keys.join(';');if(HXGL.fogSig===sig&&HXGL.fogTex)return;HXGL.fogSig=sig;
  const ks=f.keys.map(k=>k.split(',').map(Number));let q0=0,r0=0,nq=1,nr=1;
  if(ks.length){q0=Math.min(...ks.map(v=>v[0]));r0=Math.min(...ks.map(v=>v[1]));nq=Math.max(...ks.map(v=>v[0]))-q0+1;nr=Math.max(...ks.map(v=>v[1]))-r0+1}
  const d=new Uint8Array(nq*nr*4);for(const [q,r] of ks)d[((r-r0)*nq+q-q0)*4]=f.kind;
  if(HXGL.fogTex)HXGL.gl.deleteTexture(HXGL.fogTex);HXGL.fogTex=hxGLTex(nq,nr,d,false);HXGL.fogQ=[q0,r0,nq,nr]}
// drawing resolution follows the measured cost: full device pixels when cheap, fewer on slow (software) GPUs
// o (a snapshot for the PNG export): its own size, camera and pixel ratio instead of the stage's
function hxGLDraw(st,o){const gl=HXGL.gl,cv=HXGL.cv,C=HXGL.cur,c=o?o.cam:S.hx.cam;if(!gl||!HXGL.ready||!C||!c||!o&&!cv.isConnected)return;
  const k=HXGL.cost>60?.5:HXGL.cost>14?.75:1,dpr=Math.min(2,devicePixelRatio||1)*k,w=o?o.w:Math.max(1,Math.round(st.clientWidth*dpr)),h=o?o.h:Math.max(1,Math.round(st.clientHeight*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  const F=C.F,u=HXGL.u;gl.viewport(0,0,w,h);gl.useProgram(HXGL.pr);C.tex.forEach((x,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,x)});
  gl.activeTexture(gl.TEXTURE0+10);gl.bindTexture(gl.TEXTURE_2D,HXGL.fogTex);gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,HXGL.noise);gl.uniform4f(u.uFQ,...HXGL.fogQ);
  gl.uniform3f(u.uCam,c.x,c.y,c.k);gl.uniform2f(u.uVP,w,h);gl.uniform1f(u.uDpr,o?o.dpr:w/st.clientWidth);gl.uniform4f(u.uB,F.x0,F.y0,F.cw/F.P,F.ch/F.P);gl.uniform2f(u.uFS,F.cw,F.ch);
  gl.uniform4f(u.uHQ,F.hex.q0,F.hex.r0,F.hex.nq,F.hex.nr);gl.uniform1i(u.uFlat,F.flat?1:0);gl.uniform1i(u.uOne,1);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);if(o)return;cv._c={...c};cv.style.transform=''}
// the whole map at k px per hex radius, without fog, handed to cb while the canvas still holds the frame; then the stage is redrawn
function hxGLSnap(m,b,k,cb){if(!HXGL.gl||!HXGL.ready||HXGL.maps.get(m.t)?.up!==2||!hxGLUse(m.t))return false;const w=Math.round((b[2]-b[0])*k),h=Math.round((b[3]-b[1])*k),f0=HXGL.fog;
  HXGL.fog={kind:0,keys:[]};hxGLFog();hxGLDraw(null,{w,h,dpr:1,cam:{x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,k}});try{cb(HXGL.cv)}finally{HXGL.fog=f0;hxGLFog();const st=HXGL.cv.parentNode;if(st)hxGLDraw(st)}return true}
// called by hexmap.js: put the canvas under the map's SVG and draw; the first time, time one full draw to pick the drawing mode
function hxGLShow(st,m){const F=HXGL.gl&&HXGL.ready&&HXGL.maps.get(m.t);
  if(F&&!F.up)hxGLUpload(m.t,()=>{const c=typeof HX_STAGE!=='undefined'&&HX_STAGE;if(c?.st.isConnected)hxGLShow(c.st,c.m);if(typeof hxLoadTick==='function')hxLoadTick()});
  // m.alt (editor): the last painting stays until the new one is on the GPU
  if(!(F&&hxGLUse(m.t))&&!(m.alt&&hxGLUse(m.alt))){HXGL.cv?.remove();return}if(HXGL.cv.parentNode!==st)st.prepend(HXGL.cv);hxGLFog();hxGLDraw(st)}
// camera moves: redraw every animation frame while panning or zooming (a full frame costs about a millisecond on a desktop GPU);
// on a GPU too slow for that, only slide and scale the last picture and redraw when the gesture rests
function hxGLCam(st,now){const cv=HXGL.cv,c=S.hx.cam;if(!cv||!HXGL.ready||cv.parentNode!==st||!c)return;
  if(now){cancelAnimationFrame(HXGL.raf);HXGL.raf=0;hxGLDraw(st);return}
  if(!(HXGL.cost>25)){if(!HXGL.raf)HXGL.raf=requestAnimationFrame(()=>{HXGL.raf=0;if(cv.parentNode===st)hxGLDraw(st)});return}
  const b=cv._c;if(b)cv.style.transform=`translate(${(b.x-c.x)*c.k}px,${(b.y-c.y)*c.k}px) scale(${c.k/b.k})`}
