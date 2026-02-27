# LLM RULES


 - This RULES.md file is for hard LLM unbreakable rules. 
 - ARCHITECTURE.md is for saving the context of the structure of kair. It should always be updated if any change updates the structure. 
 - COMPETITION.md is for information preservation for use in future decisions.
 - DECISIONS.md is a running stream of high level decisions made so that we always have a replayable tree of why have gotten to where we are. It is appendable only. 
 - IDEAS.md is for information preservation of ideas that come up but can't be fully fleshed out at the time they were thought of. It is mutable, and we should delete IDEAS which don't need further exploration or memory retention. 
 - ROADMAP.md is for prioritizing the upcoming changes. It often gets overridden by testing what's already done, and the changes that come out of that testing. 
 - LLM's should always adhere to decisions rules documented in the docs folder ".md" files. 
 - All functionality must be CLI first.  
 - CLI Interactivity is allowed and desired.
 - Lean towards interactive questions vs parameters.
 - Backwards compatibility is not required when implementing or changing features.
 - Always update CHANGELOG.md, all md files located in "docs" with the latest information before making a commit.
 - Always commit and push the current branch to github with a detailed commit message. 

 - If a prompt or plan deviates from software development best practices you must call it out and provide a human the chance to confirm that we indeed do want to deviate from accepted best practices. 
 - 