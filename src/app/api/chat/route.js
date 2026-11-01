export async function POST(request) {
  try {
    const body = await request.json();
    const { messages = [], userContext = {} } = body;

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        {
          error:
            "⚠️ **Gemini API Key Needed**\n\nAdd `GEMINI_API_KEY=your_key_here` into `.env.local` and restart your dev server.",
        },
        { status: 400 },
      );
    }

    // Build the User's Personal Cinema Memory summary
    const watchlist = Array.isArray(userContext.watchlist)
      ? userContext.watchlist
      : [];

    let memoryContext = "No movies currently in user's personal collection.";

    if (watchlist.length > 0) {
      const summaryList = watchlist
        .slice(0, 15)
        .map((m) => {
          let details = `- "${m.title}" (${m.status || "saved"}`;
          if (m.rating) details += `, rated ${m.rating}/5 stars`;
          if (m.review) details += `, review: "${m.review.slice(0, 80)}"`;
          details += `)`;
          return details;
        })
        .join("\n");

      memoryContext = `User's Personal Cinema Library (${watchlist.length} movies):\n${summaryList}`;
    }

    const systemPromptText = `You are CineTrack AI, a sophisticated, witty, and deeply knowledgeable cinema concierge embedded in CineTrack.

USER REGION & CINEMA TASTE:
The user is based in India. Provide rich, authentic Indian and world cinema recommendations. Celebrate Hindi (Bollywood), Telugu, Tamil, Malayalam, Kannada, Bengali, and regional cinematic gems alongside curated world cinema.
When recommending films or discussing movie nights, prioritize celebrated releases, director masteries (S.S. Rajamouli, Mani Ratnam, Anurag Kashyap, Lokesh Kanagaraj, Satyajit Ray, Shoojit Sircar, etc.), and note availability on Indian streaming platforms (JioCinema, Netflix India, Prime Video, Disney+ Hotstar, Zee5, SonyLIV) unless the user specifically asks for another region.

USER PERSONAL CINEMA MEMORY:
${memoryContext}

FORMATTING & RESPONSE GUIDELINES:
1. Complete all recommendations fully and cleanly. NEVER cut off mid-sentence or leave thoughts unfinished.
2. For each recommendation, bold the title like **Movie Title (Year)** and provide:
   - The vibe / why it's special
   - Key director or standout actors
   - Where to stream in India (e.g. Netflix, Prime Video, Hotstar, JioCinema)
3. Keep the format clean, inviting, and concise (typically 2 to 3 well-crafted recommendations per question).
4. Reference the user's saved library taste when relevant.`;

    // Sanitize messages: ensure alternating user/model roles and clean text
    const cleanContents = [];

    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== "string") continue;
      if (msg.content.startsWith("⚠️")) continue;

      const role =
        msg.role === "assistant" || msg.role === "model" ? "model" : "user";

      // If previous message had the same role, merge them to satisfy Gemini's alternating rule
      if (
        cleanContents.length > 0 &&
        cleanContents[cleanContents.length - 1].role === role
      ) {
        cleanContents[cleanContents.length - 1].parts[0].text +=
          `\n\n${msg.content}`;
      } else {
        cleanContents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Gemini requires the conversation to start with 'user'
    while (cleanContents.length > 0 && cleanContents[0].role !== "user") {
      cleanContents.shift();
    }

    if (cleanContents.length === 0) {
      return new Response("What kind of movie or mood are you looking to explore tonight?", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Direct streaming call to gemini-3.8-flash
    const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(streamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPromptText }],
        },
        contents: cleanContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2500,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.json().catch(() => ({}));
      const errMsg =
        errBody?.error?.message || `HTTP ${geminiResponse.status}`;

      console.error("Gemini Streaming Error:", errMsg);

      return Response.json(
        {
          error: `⚠️ **AI Service Error (${geminiResponse.status})**: ${errMsg}`,
        },
        { status: geminiResponse.status },
      );
    }

    // Stream tokens directly to the client as they arrive from Google
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        let buffer = "";

        const processJsonChunk = (jsonString) => {
          try {
            const json = JSON.parse(jsonString);
            const candidate = json?.candidates?.[0];
            const parts = candidate?.content?.parts;

            if (Array.isArray(parts)) {
              for (const part of parts) {
                // Stream actual response text, skipping internal thought tokens
                if (part?.text && !part?.thought) {
                  controller.enqueue(encoder.encode(part.text));
                }
              }
            }
          } catch {
            // Ignore incomplete partial JSON lines until the next chunk completes them
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;

              const payload = trimmed.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;

              processJsonChunk(payload);
            }
          }

          // Flush any final buffered line
          if (buffer.trim().startsWith("data: ")) {
            const finalPayload = buffer.trim().slice(6).trim();
            if (finalPayload && finalPayload !== "[DONE]") {
              processJsonChunk(finalPayload);
            }
          }
        } catch (streamErr) {
          console.error("Stream reading error:", streamErr);
          controller.enqueue(
            encoder.encode(
              "\n\n*(Note: Connection closed by service before complete response)*",
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform, must-revalidate",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat API route error:", error);
    return Response.json(
      {
        error: `⚠️ Unexpected error: ${error instanceof Error ? error.message : "Internal Server Error"}`,
      },
      { status: 500 },
    );
  }
}
