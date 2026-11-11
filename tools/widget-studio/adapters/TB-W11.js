function(p,e,c){
 var b=p.brief; if(!b||!b.briefText) return H.need('No brief text.',['brief']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var o=H.artefact(p,c,e,'VISUAL_BRIEF'); o.brief=b.briefText; o.pedagogicalPurpose=b.purpose; var n=(b.mustAvoid||[]).map(function(x){return x.text}).concat(b.standingAvoid||[]); if(n.length) o.suggestedCompositionNotes='Avoid: '+n.join('; '); o.citedSourceIds=src; return o;
}
