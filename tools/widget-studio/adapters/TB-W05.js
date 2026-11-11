function(p,e,c){
 var S=p.slides||[]; if(!S.length) return H.need('No slides.',['slides']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var pur=c.extra.presentationPurpose; if(['INTRODUCTION','LESSON','REVIEW','CONSOLIDATION'].indexOf(pur)<0) return H.need('The agent contract asks for the presentation purpose (INTRODUCTION, LESSON, REVIEW or CONSOLIDATION). Type one.',['presentationPurpose']);
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade is outside the target band.',['measuredGrade']);
 var o=H.artefact(p,c,e,'BOARD_DECK'); o.slides=S.map(function(s){var x={title:s.lessonStep||('Slide '+s.n),content:s.text};if(s.speakerNotes)x.speakerNotes=s.speakerNotes;return x});
 o.presentationPurpose=pur; o.readabilityCheckResult=r.ok; o.citedSourceIds=src; return o;
}
