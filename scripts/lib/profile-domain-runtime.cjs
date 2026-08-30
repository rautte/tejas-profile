// scripts/lib/profile-domain-runtime.cjs

const path =
  require(
    "node:path"
  );


let registeredRoot =
  null;


/**
 * Makes the existing repository Profile/domain source callable from
 * Node without changing its CRA-friendly import style.
 *
 * The transform is intentionally restricted to repository src/**.
 *
 * We only need:
 * - ES module syntax -> CommonJS
 * - TypeScript syntax stripping
 *
 * No React/JSX/browser preset is involved.
 */
function registerProfileDomainRuntime({
  root =
    process.cwd(),
} = {}) {
  const resolvedRoot =
    path.resolve(
      root
    );

  const srcRoot =
    path.resolve(
      resolvedRoot,
      "src"
    ) + path.sep;


  if (
    registeredRoot
  ) {
    if (
      registeredRoot !==
      resolvedRoot
    ) {
      throw new Error(
        "Profile domain runtime is already registered for a different repository root."
      );
    }

    return;
  }


  process.env.NODE_ENV =
    process.env.NODE_ENV ||
    "test";

  process.env.BABEL_ENV =
    process.env.BABEL_ENV ||
    "test";


  require(
    "@babel/register"
  )({
    extensions: [
      ".js",
      ".ts",
    ],

    only: [
      (
        filename
      ) =>
        path
          .resolve(
            filename
          )
          .startsWith(
            srcRoot
          ),
    ],

    ignore: [
      /node_modules/,
    ],

    babelrc:
      false,

    configFile:
      false,

    browserslistConfigFile:
      false,

    sourceType:
      "unambiguous",

    targets: {
      node:
        process
          .versions
          .node,
    },

    plugins: [
      require.resolve(
        "@babel/plugin-transform-modules-commonjs"
      ),
    ],

    presets: [
      [
        require.resolve(
          "@babel/preset-typescript"
        ),
        {
          allExtensions:
            true,

          isTSX:
            false,

          allowDeclareFields:
            true,
        },
      ],
    ],

    cache:
      false,
  });


  registeredRoot =
    resolvedRoot;
}


/**
 * Loads the canonical repository Profile domain.
 *
 * Package construction deliberately imports the pure publication
 * domain directly instead of using the publish barrel.
 */
function loadProfileDomain({
  root =
    process.cwd(),
} = {}) {
  const resolvedRoot =
    path.resolve(
      root
    );


  registerProfileDomainRuntime({
    root:
      resolvedRoot,
  });


  const {
    buildProfileContent,
  } =
    require(
      path.resolve(
        resolvedRoot,
        "src/profile/content"
      )
    );


  const {
    createProfileDraft,
  } =
    require(
      path.resolve(
        resolvedRoot,
        "src/profile/draft"
      )
    );


  const {
    buildProfilePublicationPackage,
  } =
    require(
      path.resolve(
        resolvedRoot,
        "src/profile/publish/profilePublication.js"
      )
    );


  const {
    publishProfilePublication,
  } =
    require(
      path.resolve(
        resolvedRoot,
        "src/profile/publish/publicationTransport.js"
      )
    );


  return {
    buildProfileContent,
    createProfileDraft,
    buildProfilePublicationPackage,
    publishProfilePublication,
  };
}


module.exports = {
  loadProfileDomain,
  registerProfileDomainRuntime,
};
