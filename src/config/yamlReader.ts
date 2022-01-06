import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

const YAML_CONFIG_FILE = 'config.yml';

export default () => {
  return yaml.load(
    readFileSync(
      join(process.cwd(), '/dist/resources/', YAML_CONFIG_FILE),
      'utf-8',
    ),
  ) as Record<string, any>;
};
