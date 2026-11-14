const e=/[\u3400-\u9fff]/;function r(t,u){if(t.quiet)return"";const n=t.term(u);return t.lang==="zh"||!e.test(n)?n:""}export{r as s};
