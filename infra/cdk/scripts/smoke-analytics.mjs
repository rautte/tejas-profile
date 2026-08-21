// infra/cdk/scripts/smoke-analytics.mjs

import fs from "node:fs";


const analyticsEdgeUrl =
  String(
    process.env
      .ANALYTICS_EDGE_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");


const analyticsApiUrl =
  String(
    process.env
      .ANALYTICS_API_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");


const ownerToken =
  String(
    process.env
      .OWNER_TOKEN ||
      ""
  ).trim();


const profileVersionId =
  String(
    process.env
      .SMOKE_PROFILE_VERSION_ID ||
      "ci_smoke"
  ).trim();


function required(
  name,
  value
) {
  if (!value) {
    throw new Error(
      `${name} is required.`
    );
  }
}


required(
  "ANALYTICS_EDGE_URL",
  analyticsEdgeUrl
);

required(
  "ANALYTICS_API_URL",
  analyticsApiUrl
);

required(
  "OWNER_TOKEN",
  ownerToken
);


function utcDay(
  ts
) {
  return new Date(ts)
    .toISOString()
    .slice(0, 10);
}


async function readJson(
  response
) {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(
      text
    );
  } catch {
    throw new Error(
      `Expected JSON from ${response.url}, ` +
      `received: ${text.slice(0, 500)}`
    );
  }
}


async function publicIngest(
  payload,
  {
    owner = false,
  } = {}
) {
  const headers = {
    "content-type":
      "application/json",

    "user-agent":
      "Mozilla/5.0 TejasProfileCISmoke/1.0",
  };

  if (owner) {
    headers[
      "x-owner-token"
    ] =
      ownerToken;
  }

  const response =
    await fetch(
      `${analyticsEdgeUrl}/analytics/ingest`,
      {
        method:
          "POST",

        headers,

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  return {
    response,

    body:
      await readJson(
        response
      ),
  };
}


async function ownerQuery(
  day
) {
  const url =
    new URL(
      `${analyticsApiUrl}/analytics/query`
    );

  url.searchParams.set(
    "from",
    day
  );

  url.searchParams.set(
    "to",
    day
  );

  url.searchParams.set(
    "profileVersionId",
    profileVersionId
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "x-owner-token":
            ownerToken,

          "user-agent":
            "Mozilla/5.0 TejasProfileCISmoke/1.0",
        },
      }
    );

  const body =
    await readJson(
      response
    );

  if (
    response.status !== 200 ||
    body?.ok !== true
  ) {
    throw new Error(
      "Analytics owner query failed: " +
      `HTTP ${response.status} ` +
      JSON.stringify(
        body
      )
    );
  }

  return body;
}


function assertFiniteAtLeast(
  value,
  minimum,
  label
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number < minimum
  ) {
    throw new Error(
      `${label} expected >= ${minimum}; got ${value}`
    );
  }

  return number;
}


async function main() {
  const now =
    Date.now();

  const day =
    utcDay(now);


  // Keep one stable logical synthetic visitor/session.
  //
  // Event ID is stable per UTC day:
  // - first run that day is accepted
  // - later runs prove idempotency and may return duplicate
  //
  // This minimizes DEV Dynamo pollution while still exercising
  // the complete ingest path.
  const smokeEvent = {
    eventId:
      `ci-smoke-session-start-${day}`,

    type:
      "session_start",

    ts:
      now,

    visitorId:
      "ci-smoke-visitor-v1",

    sessionId:
      "ci-smoke-session-v1",

    tabId:
      "ci-smoke-tab-v1",

    profileVersionId,
  };


  console.log(
    "DEV Analytics smoke test"
  );

  console.log("");

  console.log(
    `Day:             ${day}`
  );

  console.log(
    `Profile version: ${profileVersionId}`
  );

  console.log("");


  // ----------------------------------------------------------
  // 1) Public edge ingest
  // ----------------------------------------------------------

  console.log(
    "1. Public edge ingest..."
  );

  const ingest =
    await publicIngest({
      events: [
        smokeEvent,
      ],
    });


  if (
    ingest.response.status !==
      200 ||
    ingest.body?.ok !== true
  ) {
    throw new Error(
      "Public analytics ingest failed: " +
      `HTTP ${ingest.response.status} ` +
      JSON.stringify(
        ingest.body
      )
    );
  }


  const accepted =
    Number(
      ingest.body
        ?.accepted ||
      0
    );

  const duplicates =
    Number(
      ingest.body
        ?.duplicates ||
      0
    );

  const rejected =
    Number(
      ingest.body
        ?.rejected ||
      0
    );


  if (
    accepted +
      duplicates !==
      1 ||
    rejected !== 0
  ) {
    throw new Error(
      "Unexpected ingest result: " +
      JSON.stringify({
        accepted,
        duplicates,
        rejected,
      })
    );
  }


  console.log(
    `   accepted=${accepted} duplicates=${duplicates} rejected=${rejected}`
  );


  // ----------------------------------------------------------
  // 2) Owner query
  // ----------------------------------------------------------

  console.log("");

  console.log(
    "2. Owner query..."
  );


  const before =
    await ownerQuery(
      day
    );


  assertFiniteAtLeast(
    before
      ?.overview
      ?.uniqueVisitors,
    1,
    "uniqueVisitors"
  );

  assertFiniteAtLeast(
    before
      ?.overview
      ?.sessions,
    1,
    "sessions"
  );


  const beforeEventCount =
    assertFiniteAtLeast(
      before
        ?.overview
        ?.eventCount,
      1,
      "eventCount"
    );


  console.log(
    `   visitors=${before.overview.uniqueVisitors}`
  );

  console.log(
    `   sessions=${before.overview.sessions}`
  );

  console.log(
    `   eventCount=${beforeEventCount}`
  );


  // ----------------------------------------------------------
  // 3) Owner ingest exclusion
  // ----------------------------------------------------------

  console.log("");

  console.log(
    "3. Owner exclusion..."
  );


  const ownerEvent = {
    ...smokeEvent,

    eventId:
      `ci-smoke-owner-${process.env.GITHUB_RUN_ID || now}`,

    ts:
      Date.now(),
  };


  const ownerIngest =
    await publicIngest(
      {
        events: [
          ownerEvent,
        ],
      },
      {
        owner:
          true,
      }
    );


  if (
    ownerIngest
      .response
      .status !==
      204
  ) {
    throw new Error(
      "Owner ingest was not excluded: " +
      `HTTP ${ownerIngest.response.status} ` +
      JSON.stringify(
        ownerIngest.body
      )
    );
  }


  console.log(
    "   owner ingest returned 204"
  );


  // ----------------------------------------------------------
  // 4) Verify owner request changed nothing
  // ----------------------------------------------------------

  console.log("");

  console.log(
    "4. Verify metrics unchanged..."
  );


  const after =
    await ownerQuery(
      day
    );


  const afterEventCount =
    Number(
      after
        ?.overview
        ?.eventCount
    );


  if (
    afterEventCount !==
    beforeEventCount
  ) {
    throw new Error(
      "Owner traffic changed analytics metrics: " +
      `before=${beforeEventCount} ` +
      `after=${afterEventCount}`
    );
  }


  console.log(
    `   eventCount unchanged at ${afterEventCount}`
  );


  console.log("");

  console.log(
    "DEV Analytics smoke test PASSED."
  );


  if (
    process.env
      .GITHUB_STEP_SUMMARY
  ) {
    fs.appendFileSync(
      process.env
        .GITHUB_STEP_SUMMARY,

      [
        "## DEV Analytics smoke test",
        "",
        "| Check | Result |",
        "| --- | --- |",
        `| Public edge ingest | ✅ accepted=${accepted}, duplicates=${duplicates} |`,
        "| Owner analytics query | ✅ Passed |",
        "| Owner traffic exclusion | ✅ 204 |",
        `| Metrics unchanged after owner request | ✅ ${afterEventCount} events |`,
        "",
        `Profile version: \`${profileVersionId}\``,
        "",
      ].join("\n")
    );
  }
}


main()
  .catch(
    (error) => {
      console.error("");

      console.error(
        "DEV Analytics smoke test FAILED."
      );

      console.error(
        error instanceof Error
          ? error.message
          : String(error)
      );

      process.exitCode =
        1;
    }
  );