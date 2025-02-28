import { TableOptions } from "@nocobase/database";

export default {
  name: 'categories',
  fields: [
    {
      type: 'string',
      name: 'title',
    },
    {
      type: 'hasMany',
      name: 'posts',
    },
  ]
} as TableOptions;
