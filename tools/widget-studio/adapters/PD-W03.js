function(p,e,c){
 var T=p.themes||[]; if(!T.length) return H.need('No theme met the minimum number of notes and grades, so none is reported.',['themes']);
 var o=H.base(c); o.status='ok'; o.notesAnalysed=p.notesUsed||0;
 o.themes=T.map(function(t){return {theme:t.theme,supportingFoci:t.grades||[],evidenceStrength:t.notes>=6?'strong':t.notes>=4?'consistent':'emerging',illustrativeExamples:(t.noteIds||[]).map(function(n){return 'Note '+n})}});
 o.priorityAreas=T.slice().sort(function(a,b){return b.notes-a.notes}).slice(0,3).map(function(t){return t.theme});
 o.summary=T.length+' theme(s) from '+o.notesAnalysed+' note(s). Counts only; no names. AI drafts; the PD coordinator decides.'; o.citedSourceIds=H.src(p); return o;
}
