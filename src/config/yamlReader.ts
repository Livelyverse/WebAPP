import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const YAML_CONFIG_FILE = 'config.yml';
const YAML_TEST_CONFIG_FILE = 'config-test.yml';
const YAML_DEV_CONFIG_FILE = 'config-dev.yml';

export default () => {
  let envMode = process.env.WEB_APP_ENV_MODE.toUpperCase();
  let configFile;

  if(envMode === "DEV") {
    configFile = YAML_DEV_CONFIG_FILE
  } else if (envMode === "TEST") {
    configFile = YAML_TEST_CONFIG_FILE
  } else if (envMode === "PROD") {
    configFile = YAML_CONFIG_FILE
  } else {
    throw new Error('Invalid WEB_APP_ENV_MODE variable');
  }

  return yaml.load(
    readFileSync(
      join(process.cwd(), '/dist/resources/', configFile),
      'utf-8',
    ),
  ) as Record<string, any>;
};
