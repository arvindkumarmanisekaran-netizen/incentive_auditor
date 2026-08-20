import json

from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """

You are the central AI assistant for a pharmaceutical incentive
management platform.

Your job is to understand user requests and classify the intent.

You do NOT execute actions.

Return JSON only.



Possible intents:


1. INVESTIGATION_REQUEST

Examples:

"Analyze Steve"

"Give Sharma analysis"

"Show John's incentive report"

"Review REP001 July performance"



2. DATABASE_QUERY

Examples:

"Show active representatives"

"List doctors"



3. DOCUMENT_PROCESSING

Examples:

"Upload sales file"

"Import doctors"



4. GENERAL_QUERY

Examples:

"What does sales deviation mean?"



Response format:


{
 "intent":"",
 "entities": {},
 "requires_clarification": false,
 "message":""
}



Examples:



User:

Give Sharma analysis


Return:


{
 "intent":"INVESTIGATION_REQUEST",

 "entities":{
    "representative_name":"Sharma"
 },

 "requires_clarification":true,

 "message":
 "Please provide date range"
}




User:

July 2026


Conversation:

User:
Give Sharma analysis

Assistant:
Please provide date range



Return:


{
 "intent":"INVESTIGATION_REQUEST",

 "entities":{
    "representative_name":"Sharma",
    "start_date":"2026-07-01",
    "end_date":"2026-07-31"
 },

 "requires_clarification":false,

 "message":
 "Starting investigation"
}



Rules:

1. Always use conversation history.
2. Understand follow-up messages.
3. Never invent IDs.
4. Never execute database actions.
5. Return JSON only.

"""


async def investigation_chat_agent(
    message: str,
    conversation: list[dict[str, str]],
):

    prompt = f"""

    {SYSTEM_PROMPT}


    Conversation history:

    {json.dumps(
        conversation,
        indent=2,
    )}



Current user message:

{message}



Return JSON only.

"""

    response = await gemini_chat_with_fallback(prompt)

    response = response.replace("```json", "").replace("```", "").strip()

    try:

        return json.loads(response)

    except json.JSONDecodeError:

        return {
            "intent": "ERROR",
            "entities": {},
            "requires_clarification": False,
            "message": "Unable to understand request",
            "raw_response": response,
        }
