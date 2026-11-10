function(p,e,c){
 var L=p.lines||[]; if(!L.length) return {status:'no_source_content',detail:'There are no lines to adapt.'};
 var M={isizulu:'zu',zulu:'zu',isixhosa:'xh',xhosa:'xh',afrikaans:'af',english:'en',isindebele:'nr',ndebele:'nr',sepedi:'nso','northern sotho':'nso',sesotho:'st',sotho:'st',setswana:'tn',tswana:'tn',siswati:'ss',swati:'ss',tshivenda:'ve',venda:'ve',xitsonga:'ts',tsonga:'ts'}, code=M[String(p.targetLanguage).toLowerCase()]||(/^(af|en|nr|xh|zu|nso|st|tn|ss|ve|ts)$/.test(p.targetLanguage)?p.targetLanguage:null);
 if(!code) return H.need('The target language "'+p.targetLanguage+'" is not one the agent contract lists.',['targetLanguage']);
 var o=H.artefact(p,c,e,'HOME_LANGUAGE_ADAPTED'); o.adaptedContent=L.map(function(l){return l.translation}).join('\n'); o.targetLanguage=code;
 var human=p.reviewer!=null&&!p.machineTranslation; o.requiresHumanReview=!human; if(!human) o.reviewReason=p.machineTranslation?'Machine translation: a person must review it.':'No reviewer has checked this translation.'; return o;
}
