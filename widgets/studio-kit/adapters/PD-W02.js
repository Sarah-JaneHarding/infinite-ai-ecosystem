function(p,e,c){
 var I=p.items||[]; if(!I.length) return H.need('No items analysed.',['items']);
 var map=[['know','remember'],['recall','remember'],['remember','remember'],['understand','understand'],['comprehen','understand'],['appl','apply'],['analy','analyse'],['evaluat','evaluate'],['creat','create'],['synth','create']],cc={remember:0,understand:0,apply:0,analyse:0,evaluate:0,create:0},unm=[];
 I.forEach(function(i){var l=String(i.level||'').toLowerCase(),m=map.filter(function(x){return l.indexOf(x[0])===0})[0];if(m)cc[m[1]]++;else unm.push(i.level)});
 var miss=[]; if(unm.length) miss.push('cognitiveLevelCounts (unrecognised level: '+H.uniq(unm).join(', ')+')');
 var disc=I.map(function(i){return i.discrimination}).filter(function(x){return typeof x==='number'}); if(!disc.length) miss.push('meanDiscrimination ('+(p.discrimination||'not computed')+')');
 miss.push('meanMarkingConsistency (not measured by this widget)');
 if(miss.length) return H.need('The widget cannot fill every field the agent contract requires. Missing: '+miss.join('; ')+'.',miss);
}
