function(p,e,c){
 var A=p.activities||[]; if(!A.length) return H.need('No activities in the course.',['activities']);
 var type={Opening:'input',Learn:'input',Practise:'deliberate_practice',Check:'check_for_understanding',Model:'model'};
 var cfu=p.checkForUnderstanding;
 var mods=A.map(function(a){return {title:a.section+' '+a.activityNo,type:type[a.section]||'input',estimatedMinutes:a.minutes,content:a.participantsDo,materials:a.source&&a.source.title?[a.source.title]:[]}});
 if(cfu&&cfu.question) mods.push({title:'Check for understanding',type:'check_for_understanding',estimatedMinutes:cfu.minutes||5,content:cfu.question,materials:[]});
 var o=H.base(c); o.status='ok'; o.courseId=c.idFor(e.runId); o.title=p.title; o.targetGap=p.gapLabel; o.totalEstimatedMinutes=mods.reduce(function(s,m){return s+m.estimatedMinutes},0);
 o.modules=mods; o.checkItems=cfu&&cfu.question?[cfu.question]:[]; o.citedSourceIds=(p.sources||[]).map(function(s){return s.id}); o.exportable=true; return o;
}
