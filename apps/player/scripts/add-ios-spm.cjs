const path = require('path');

const { loadConfig } = require('@capacitor/cli/dist/config');
const { addCommand } = require('@capacitor/cli/dist/tasks/add');

async function main() {
  const config = await loadConfig();

  // Capacitor CLI 7.2.x still routes `cap add ios --packagemanager SPM`
  // through CocoaPods checks, so we force the SPM template directly here.
  config.ios.packageManager = Promise.resolve('SPM');
  config.cli.assets.ios.platformTemplateArchive = 'ios-spm-template.tar.gz';
  config.cli.assets.ios.platformTemplateArchiveAbs = path.resolve(
    config.cli.assetsDirAbs,
    config.cli.assets.ios.platformTemplateArchive,
  );

  await addCommand(config, 'ios');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
