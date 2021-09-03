import Database from '@nocobase/database';
import api from '../app';

(async () => {
  await api.loadPlugins();
  const database: Database = api.database;
  await database.sync({
    // tables: ['collections', 'fields', 'actions', 'views', 'tabs'],
  });
  await database.close();
})();