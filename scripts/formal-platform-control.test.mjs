import test from "node:test";
import assert from "node:assert/strict";

import http from "node:http";

import {
  spawn,
} from "node:child_process";

import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  fileURLToPath,
} from "node:url";


const THIS_FILE =
  fileURLToPath(
    import.meta.url
  );

const ROOT =
  path.resolve(
    path.dirname(
      THIS_FILE
    ),
    ".."
  );


function respondJson(
  response,
  status,
  value
) {
  const body =
    JSON.stringify(
      value
    );

  response.writeHead(
    status,
    {
      "content-type":
        "application/json",

      "content-length":
        Buffer.byteLength(
          body
        ),
    }
  );

  response.end(
    body
  );
}


function readBody(
  request
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let body =
        "";

      request.setEncoding(
        "utf8"
      );

      request.on(
        "data",
        chunk => {
          body +=
            chunk;
        }
      );

      request.on(
        "end",
        () => {
          resolve(
            body
          );
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}


function runControl(
  env
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const child =
        spawn(
          process.execPath,
          [
            "scripts/formal-platform-control.mjs",
            "commit",
          ],
          {
            cwd:
              ROOT,

            env: {
              ...process.env,
              ...env,
            },

            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
          }
        );

      let stdout =
        "";

      let stderr =
        "";

      child.stdout.on(
        "data",
        chunk => {
          stdout +=
            chunk;
        }
      );

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            chunk;
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {
          resolve({
            code,
            stdout,
            stderr,
          });
        }
      );
    }
  );
}


test(
  "formal Platform commit accepts the canonical nested Deployment Configuration create response",
  async () => {
    const platformReleaseId =
      "plr_test_runtime_boundary";

    const platformDeploymentId =
      "pdep_test_runtime_boundary";

    const profileVariantId =
      "prv_test_runtime_boundary";

    const platformReleaseSha256 =
      "a".repeat(
        64
      );

    const seen = {
      config:
        null,

      commit:
        null,
    };


    const server =
      http.createServer(
        async (
          request,
          response
        ) => {
          try {
            if (
              request.method ===
                "GET" &&
              request.url ===
                "/profile/active"
            ) {
              respondJson(
                response,
                200,
                {
                  ok:
                    true,

                  active: {
                    profileVariantId,
                  },

                  variant: {
                    profileVariantId,
                  },
                }
              );

              return;
            }


            if (
              request.method ===
                "POST" &&
              request.url ===
                "/deployment-configurations/create"
            ) {
              const body =
                JSON.parse(
                  await readBody(
                    request
                  )
                );

              seen.config =
                body;

              respondJson(
                response,
                201,
                {
                  ok:
                    true,

                  alreadyCreated:
                    false,

                  deploymentConfigurationId:
                    "cfg_test_runtime_boundary",

                  configurationSha256:
                    "b".repeat(
                      64
                    ),

                  configuration: {
                    deploymentConfigurationId:
                      "cfg_test_runtime_boundary",

                    platformReleaseId,

                    profileVariantId,
                  },
                }
              );

              return;
            }


            if (
              request.method ===
                "POST" &&
              request.url ===
                "/platform-deployments/commit"
            ) {
              const body =
                JSON.parse(
                  await readBody(
                    request
                  )
                );

              seen.commit =
                body;

              respondJson(
                response,
                201,
                {
                  ok:
                    true,

                  active: {
                    deploymentId:
                      platformDeploymentId,

                    platformReleaseId,

                    platformReleaseSha256,

                    deployedAt:
                      "2026-08-31T08:40:00.000Z",
                  },
                }
              );

              return;
            }


            respondJson(
              response,
              404,
              {
                ok:
                  false,
              }
            );
          } catch (
            error
          ) {
            respondJson(
              response,
              500,
              {
                ok:
                  false,

                error:
                  String(
                    error?.message ||
                    error
                  ),
              }
            );
          }
        }
      );


    await new Promise(
      (
        resolve,
        reject
      ) => {
        server.once(
          "error",
          reject
        );

        server.listen(
          0,
          "127.0.0.1",
          resolve
        );
      }
    );


    const address =
      server.address();

    assert.ok(
      address &&
      typeof address !==
        "string"
    );


    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    const tmp =
      await mkdtemp(
        path.join(
          os.tmpdir(),
          "tejas-profile-platform-control-"
        )
      );

    const githubOutput =
      path.join(
        tmp,
        "github-output.txt"
      );

    const githubSummary =
      path.join(
        tmp,
        "github-summary.txt"
      );


    await writeFile(
      githubOutput,
      ""
    );

    await writeFile(
      githubSummary,
      ""
    );


    try {
      const result =
        await runControl({
          SNAPSHOTS_API_URL:
            baseUrl,

          ACTIVE_PROFILE_API_URL:
            `${baseUrl}/profile/active`,

          OWNER_TOKEN:
            "test-owner-token",

          PLATFORM_RELEASE_ID:
            platformReleaseId,

          PLATFORM_RELEASE_SHA256:
            platformReleaseSha256,

          PLATFORM_DEPLOYMENT_ID:
            platformDeploymentId,

          GITHUB_OUTPUT:
            githubOutput,

          GITHUB_STEP_SUMMARY:
            githubSummary,
        });


      assert.equal(
        result.code,
        0,
        [
          result.stdout,
          result.stderr,
        ].join(
          "\n"
        )
      );


      assert.deepEqual(
        seen.config,
        {
          platformReleaseId,
          profileVariantId,
        }
      );


      assert.deepEqual(
        seen.commit,
        {
          deploymentId:
            platformDeploymentId,

          platformReleaseId,
        }
      );


      assert.match(
        result.stdout,
        /Deployment Configuration ready: cfg_test_runtime_boundary/
      );

      assert.match(
        result.stdout,
        /Formal Platform Deployment committed\./
      );
    } finally {
      await new Promise(
        resolve =>
          server.close(
            resolve
          )
      );

      await rm(
        tmp,
        {
          recursive:
            true,

          force:
            true,
        }
      );
    }
  }
);
