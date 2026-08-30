// scripts/formal-platform-control.mjs

import {
  execFileSync,
} from "node:child_process";

import {
  appendFileSync,
} from "node:fs";


function fail(
  message
) {
  throw new Error(
    message
  );
}


function requiredEnv(
  name
) {
  const value =
    String(
      process.env[name] ||
      ""
    ).trim();


  if (!value) {
    fail(
      `${name} is required.`
    );
  }


  return value;
}


function optionalEnv(
  name
) {
  return String(
    process.env[name] ||
    ""
  ).trim();
}


function requireSha256(
  value,
  name
) {
  if (
    !/^[0-9a-f]{64}$/.test(
      value
    )
  ) {
    fail(
      `${name} must be a lowercase SHA-256 value.`
    );
  }


  return value;
}


function requireGitSha(
  value
) {
  if (
    !/^[0-9a-f]{40}$/.test(
      value
    )
  ) {
    fail(
      "GIT_SHA must be an exact 40-character Git SHA."
    );
  }


  return value;
}


function writeOutput(
  name,
  value
) {
  const outputPath =
    optionalEnv(
      "GITHUB_OUTPUT"
    );


  if (outputPath) {
    appendFileSync(
      outputPath,
      `${name}=${value}\n`,
      "utf8"
    );
  }


  console.log(
    `${name}=${value}`
  );
}


function writeSummary(
  lines
) {
  const summaryPath =
    optionalEnv(
      "GITHUB_STEP_SUMMARY"
    );


  if (!summaryPath) {
    return;
  }


  appendFileSync(
    summaryPath,
    `${lines.join("\n")}\n`,
    "utf8"
  );
}


function git(
  ...args
) {
  return execFileSync(
    "git",
    args,
    {
      encoding:
        "utf8",

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    }
  ).trim();
}


function readChangedFiles() {
  const parentLine =
    git(
      "rev-list",
      "--parents",
      "-n",
      "1",
      "HEAD"
    );


  const parts =
    parentLine
      .split(/\s+/)
      .filter(Boolean);


  let output;


  if (
    parts.length >
      1
  ) {
    const firstParent =
      parts[1];


    output =
      git(
        "diff",
        "--name-only",
        firstParent,
        "HEAD",
        "--"
      );
  } else {
    output =
      git(
        "ls-tree",
        "-r",
        "--name-only",
        "HEAD"
      );
  }


  return output
    .split("\n")
    .map(
      (value) =>
        value.trim()
    )
    .filter(Boolean);
}


function classifyDiffFiles(
  files
) {
  const diffFiles = {
    infra:
      [],

    data:
      [],

    uiux:
      [],

    githubWorkflow:
      [],
  };


  for (
    const file
    of files
  ) {
    if (
      /^infra\/cdk\//.test(
        file
      )
    ) {
      diffFiles
        .infra
        .push(
          file
        );
    }


    if (
      /^src\/data\//.test(
        file
      )
    ) {
      diffFiles
        .data
        .push(
          file
        );
    }


    if (
      /^src\//.test(
        file
      ) &&
      !/^src\/data\//.test(
        file
      )
    ) {
      diffFiles
        .uiux
        .push(
          file
        );
    }


    if (
      /^\.github\/workflows\//.test(
        file
      )
    ) {
      diffFiles
        .githubWorkflow
        .push(
          file
        );
    }
  }


  for (
    const key
    of Object.keys(
      diffFiles
    )
  ) {
    diffFiles[key] =
      [
        ...new Set(
          diffFiles[key]
        ),
      ].sort();
  }


  return diffFiles;
}


function diffTagValue(
  diffFiles
) {
  const parts =
    [];


  if (
    diffFiles
      .infra
      .length
  ) {
    parts.push(
      "infra"
    );
  }


  if (
    diffFiles
      .data
      .length
  ) {
    parts.push(
      "data"
    );
  }


  if (
    diffFiles
      .uiux
      .length
  ) {
    parts.push(
      "uiux"
    );
  }


  if (
    diffFiles
      .githubWorkflow
      .length
  ) {
    parts.push(
      "githubWorkflow"
    );
  }


  return parts.length
    ? parts.join(
        "_"
      )
    : "none";
}


async function request({
  url,

  method =
    "GET",

  ownerToken =
    "",

  body =
    undefined,
}) {
  const headers = {
    accept:
      "application/json",
  };


  if (
    body !==
      undefined
  ) {
    headers[
      "content-type"
    ] =
      "application/json";
  }


  if (
    ownerToken
  ) {
    headers[
      "x-owner-token"
    ] =
      ownerToken;
  }


  const response =
    await fetch(
      url,
      {
        method,

        headers,

        body:
          body ===
            undefined
            ? undefined
            : JSON.stringify(
                body
              ),
      }
    );


  const text =
    await response.text();


  let json =
    null;


  if (
    text
  ) {
    try {
      json =
        JSON.parse(
          text
        );
    } catch {
      json =
        null;
    }
  }


  return {
    status:
      response.status,

    ok:
      response.ok,

    text,

    json,
  };
}


function requireSuccessfulJson(
  result,
  context
) {
  if (
    !result.ok
  ) {
    fail(
      `${context} failed with HTTP ${result.status}: ${result.text}`
    );
  }


  if (
    !result.json ||
    result.json.ok !==
      true
  ) {
    fail(
      `${context} did not return ok=true.`
    );
  }


  return result.json;
}


async function registerRelease() {
  const stage =
    requiredEnv(
      "STAGE"
    );


  if (
    stage !==
      "dev" &&
    stage !==
      "prod"
  ) {
    fail(
      'STAGE must be "dev" or "prod".'
    );
  }


  const snapshotsApiUrl =
    requiredEnv(
      "SNAPSHOTS_API_URL"
    ).replace(
      /\/+$/,
      ""
    );


  const ownerToken =
    requiredEnv(
      "OWNER_TOKEN"
    );


  const platformReleaseId =
    requiredEnv(
      "PLATFORM_RELEASE_ID"
    );


  const gitSha =
    requireGitSha(
      requiredEnv(
        "GIT_SHA"
      )
    );


  const gitRef =
    requiredEnv(
      "GIT_REF"
    );


  const buildTime =
    requiredEnv(
      "BUILD_TIME"
    );


  const checkpointTag =
    requiredEnv(
      "CHECKPOINT_TAG"
    );


  const frontendArtifactSha256 =
    requireSha256(
      requiredEnv(
        "FRONTEND_ARTIFACT_SHA256"
      ),

      "FRONTEND_ARTIFACT_SHA256"
    );


  const githubRunId =
    requiredEnv(
      "GITHUB_RUN_ID"
    );


  const repository =
    requiredEnv(
      "REPOSITORY"
    );


  const legacyProfileVersion =
    optionalEnv(
      "LEGACY_PROFILE_VERSION"
    );


  const changedFiles =
    readChangedFiles();


  const diffFiles =
    classifyDiffFiles(
      changedFiles
    );


  const tagValue =
    diffTagValue(
      diffFiles
    );


  const release = {
    schema:
      "tejas-profile.platform-release",

    schemaId:
      "tejas-profile.platform-release.v2",

    platformReleaseId,

    stage,

    createdAt:
      new Date()
        .toISOString(),

    source: {
      repository,

      gitSha,

      gitRef,

      checkpointTag,
    },

    build: {
      buildTime,

      frontendArtifactSha256,

      githubRunId,

      diffFiles,

      diffTagValue:
        tagValue,
    },

    profileRuntime: {
      ppsVersion:
        1,
    },

    ...(legacyProfileVersion
      ? {
          legacy: {
            profileVersionId:
              legacyProfileVersion,
          },
        }
      : {}),
  };


  console.log(
    "Registering immutable Platform Release:"
  );

  console.log(
    JSON.stringify(
      release,
      null,
      2
    )
  );


  const result =
    await request({
      url:
        `${snapshotsApiUrl}/platform-releases/register`,

      method:
        "POST",

      ownerToken,

      body: {
        release,
      },
    });


  const response =
    requireSuccessfulJson(
      result,
      "Platform Release registration"
    );


  if (
    response
      .platformReleaseId !==
      platformReleaseId
  ) {
    fail(
      "Registered Platform Release identity mismatch."
    );
  }


  const releaseSha256 =
    requireSha256(
      String(
        response
          .releaseSha256 ||
        ""
      ),

      "releaseSha256"
    );


  writeOutput(
    "platform_release_id",
    platformReleaseId
  );


  writeOutput(
    "release_sha256",
    releaseSha256
  );


  writeOutput(
    "diff_tag_value",
    tagValue
  );


  writeSummary([
    "",
    "## DEV Formal Platform Release",
    "",
    `- Platform Release: \`${platformReleaseId}\``,
    `- Git SHA: \`${gitSha}\``,
    `- Frontend artifact SHA-256: \`${frontendArtifactSha256}\``,
    `- Release SHA-256: \`${releaseSha256}\``,
    "- Deployment state: **registered, not yet committed**",
    "",
  ]);


  console.log(
    "Immutable Platform Release registered."
  );
}


function sleep(
  milliseconds
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}


async function prepareConfiguration({
  snapshotsApiUrl,
  ownerToken,
  platformReleaseId,
  profileVariantId,
}) {
  const result =
    await request({
      url:
        `${snapshotsApiUrl}/deployment-configurations/create`,

      method:
        "POST",

      ownerToken,

      body: {
        platformReleaseId,

        profileVariantId,
      },
    });


  if (
    result.status !==
      200 &&
    result.status !==
      201
  ) {
    fail(
      `Deployment Configuration preparation failed with HTTP ${result.status}: ${result.text}`
    );
  }


  const response =
    requireSuccessfulJson(
      result,
      "Deployment Configuration preparation"
    );


  if (
    response
      ?.configuration
      ?.platformReleaseId !==
      platformReleaseId
  ) {
    fail(
      "Deployment Configuration Platform Release mismatch."
    );
  }


  if (
    response
      ?.configuration
      ?.profileVariantId !==
      profileVariantId
  ) {
    fail(
      "Deployment Configuration Profile Variant mismatch."
    );
  }


  const configurationId =
    String(
      response
        ?.deploymentConfigurationId ||
      ""
    ).trim();


  if (
    !configurationId
  ) {
    fail(
      "Deployment Configuration ID is missing."
    );
  }


  console.log(
    `Deployment Configuration ready: ${configurationId}`
  );
}


async function commitDeployment() {
  const snapshotsApiUrl =
    requiredEnv(
      "SNAPSHOTS_API_URL"
    ).replace(
      /\/+$/,
      ""
    );


  const activeProfileApiUrl =
    requiredEnv(
      "ACTIVE_PROFILE_API_URL"
    );


  const ownerToken =
    requiredEnv(
      "OWNER_TOKEN"
    );


  const platformReleaseId =
    requiredEnv(
      "PLATFORM_RELEASE_ID"
    );


  const platformReleaseSha256 =
    requireSha256(
      requiredEnv(
        "PLATFORM_RELEASE_SHA256"
      ),

      "PLATFORM_RELEASE_SHA256"
    );


  const platformDeploymentId =
    requiredEnv(
      "PLATFORM_DEPLOYMENT_ID"
    );


  const maxAttempts =
    12;


  for (
    let attempt =
      1;

    attempt <=
      maxAttempts;

    attempt +=
      1
  ) {
    console.log(
      `Formal Platform Deployment attempt ${attempt}/${maxAttempts}`
    );


    const activeResult =
      await request({
        url:
          activeProfileApiUrl,
      });


    const activeResponse =
      requireSuccessfulJson(
        activeResult,
        "Active Profile read"
      );


    const pointerProfileVariantId =
      String(
        activeResponse
          ?.active
          ?.profileVariantId ||
        ""
      ).trim();


    const variantProfileVariantId =
      String(
        activeResponse
          ?.variant
          ?.profileVariantId ||
        ""
      ).trim();


    if (
      pointerProfileVariantId &&
      !variantProfileVariantId
    ) {
      fail(
        "Active Profile returned an active pointer without its variant."
      );
    }


    if (
      !pointerProfileVariantId &&
      variantProfileVariantId
    ) {
      fail(
        "Active Profile returned a variant without an active pointer."
      );
    }


    if (
      pointerProfileVariantId &&
      pointerProfileVariantId !==
        variantProfileVariantId
    ) {
      fail(
        "Active Profile pointer/variant identity mismatch."
      );
    }


    if (
      pointerProfileVariantId
    ) {
      await prepareConfiguration({
        snapshotsApiUrl,

        ownerToken,

        platformReleaseId,

        profileVariantId:
          pointerProfileVariantId,
      });
    } else {
      console.log(
        "No active Profile exists; commit will atomically guard Profile absence."
      );
    }


    const commitResult =
      await request({
        url:
          `${snapshotsApiUrl}/platform-deployments/commit`,

        method:
          "POST",

        ownerToken,

        body: {
          deploymentId:
            platformDeploymentId,

          platformReleaseId,
        },
      });


    if (
      commitResult.status ===
        409
    ) {
      console.log(
        "Control-plane state changed during preparation; retrying."
      );

      console.log(
        commitResult.text
      );


      if (
        attempt ===
          maxAttempts
      ) {
        fail(
          `Formal Platform Deployment could not stabilize after ${maxAttempts} attempts.`
        );
      }


      await sleep(
        1000
      );


      continue;
    }


    if (
      commitResult.status !==
        200 &&
      commitResult.status !==
        201
    ) {
      fail(
        `Platform Deployment commit failed with HTTP ${commitResult.status}: ${commitResult.text}`
      );
    }


    const response =
      requireSuccessfulJson(
        commitResult,
        "Platform Deployment commit"
      );


    const active =
      response.active ||
      {};


    if (
      active
        .deploymentId !==
        platformDeploymentId
    ) {
      fail(
        "Committed Platform deploymentId mismatch."
      );
    }


    if (
      active
        .platformReleaseId !==
        platformReleaseId
    ) {
      fail(
        "Committed Platform platformReleaseId mismatch."
      );
    }


    if (
      active
        .platformReleaseSha256 !==
        platformReleaseSha256
    ) {
      fail(
        "Committed Platform release SHA-256 mismatch."
      );
    }


    const deployedAt =
      String(
        active
          .deployedAt ||
        ""
      ).trim();


    if (
      !deployedAt
    ) {
      fail(
        "Committed Platform deployedAt is missing."
      );
    }


    writeOutput(
      "deployment_id",
      platformDeploymentId
    );


    writeOutput(
      "deployed_at",
      deployedAt
    );


    writeSummary([
      "",
      "## DEV Formal Platform Deployment",
      "",
      `- Platform Release: \`${platformReleaseId}\``,
      `- Deployment occurrence: \`${platformDeploymentId}\``,
      `- Deployed at: \`${deployedAt}\``,
      "- Control plane: **committed**",
      "",
    ]);


    console.log(
      "Formal Platform Deployment committed."
    );


    return;
  }


  fail(
    "Formal Platform Deployment loop exited unexpectedly."
  );
}


async function main() {
  const command =
    String(
      process.argv[2] ||
      ""
    ).trim();


  if (
    command ===
      "register"
  ) {
    await registerRelease();

    return;
  }


  if (
    command ===
      "commit"
  ) {
    await commitDeployment();

    return;
  }


  fail(
    'Usage: node scripts/formal-platform-control.mjs <register|commit>'
  );
}


main().catch(
  (error) => {
    console.error(
      error
    );

    process.exit(
      1
    );
  }
);