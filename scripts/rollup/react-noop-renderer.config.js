import {
  getPackageJson,
  resolvePkgPath,
  getBaseRollupPlugins,
} from './utils.js';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPackageJson(
  'react-noop-renderer'
);

// react-noop-renderer 包路径
const pkgPath = resolvePkgPath(name);

// react-noop-renderer 产物路径
const pkgDistPath = resolvePkgPath(name, true);

const basePlugins = getBaseRollupPlugins({
  typescript: {
    exclude: ['./packages/react-dom/**/*'],
    tsconfigOverride: {
      compilerOptions: {
        paths: {
          hostConfig: [`./${name}/src/hostConfig.ts`],
        },
      },
    },
  },
});

export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: 'umd',
      },
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...basePlugins,
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.js`,
        },
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version, ...args }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version,
          },
          main: 'index.js',
        }),
      }),
    ],
  },
];
