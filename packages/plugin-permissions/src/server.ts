import path from 'path';
import { Op } from 'sequelize';
import { Application } from '@nocobase/server';
import { Operator } from '@nocobase/database';
import * as collectionsRolesActions from './actions/collections.roles';
import * as rolesCollectionsActions from './actions/roles.collections';
import AccessController, { PermissionParams } from './AccessController';

// API
// const permissions = ctx.app.getPluginInstance('permissions');
// const result: boolean = permissions.can(key, options);



export class Permissions {
  readonly app: Application;
  readonly options: any;

  constructor(app: Application, options) {
    this.app = app;
    this.options = options;

    const { database, resourcer } = app;

    database.import({
      directory: path.resolve(__dirname, 'collections'),
    });

    Object.keys(collectionsRolesActions).forEach(actionName => {
      resourcer.registerActionHandler(`collections.roles:${actionName}`, collectionsRolesActions[actionName]);
    });

    Object.keys(rolesCollectionsActions).forEach(actionName => {
      resourcer.registerActionHandler(`roles.collections:${actionName}`, rolesCollectionsActions[actionName]);
    });

    database.getModel('collections').addHook('afterCreate', async (model: any, options) => {
      await model.updateAssociations({
        scopes: [
          {
            title: '全部数据',
            filter: {},
            locked: true
          },
          {
            title: '用户自己的数据',
            filter: {
              "created_by_id.$currentUser": true,
            },
            locked: true
          },
        ]
      }, options);
    });

    database.getModel('users').addHook('afterCreate', async(model, options) => {
      const { transaction = await database.sequelize.transaction() } = options;
      const Role = database.getModel('roles');
      const defaultRole = await Role.findOne({ where: { default: true }, transaction });
      if (defaultRole) {
        // @ts-ignore
        await model.addRole(defaultRole, { transaction });
      }
      if (!options.transaction) {
        await transaction.commit();
      }
    });

    // 针对“自己创建的” scope 添加特殊的操作符以生成查询条件
    if (!Operator.has('$currentUser')) {
      Operator.register('$currentUser', (value, { ctx }) => {
        const user = ctx.state.currentUser;
        return { [Op.eq]: user[user.constructor.primaryKeyAttribute] };
      });
    }

    resourcer.use(this.injection);
    resourcer.use(this.middleware);

    resourcer.use(async (ctx, next) => {
      const { resourceName } = ctx.action.params;
      if (resourceName === 'action_logs' && !await ctx.ac.isRoot()) {
        const collections = await ctx.ac.getCollections();
        ctx.action.mergeParams({
          filter: {
            'collection_name.in': collections
          },
        });
      }
      await next();
    });
  }

  injection = async (ctx, next) => {
    ctx.ac = new AccessController(ctx);

    return next();
  };

  middleware = async (ctx, next) => {
    const {
      associatedName,
      resourceField,
      resourceName,
      actionName
    } = ctx.action.params;

    let result: PermissionParams = false;

    // 关系数据的权限
    if (associatedName && resourceField) {
      if (resourceField.options.id && resourceField.options.interface === 'subTable') {
        if (await ctx.ac.isRoot()) {
          return next();
        }
        const permissions = await ctx.ac.getPermissions();
        const FieldPermission = ctx.db.getModel('fields_permissions');
        const fps = await FieldPermission.findAll({
          where: {
            field_id: resourceField.options.id,
            permission_id: {
              [Op.in]: permissions.map(p => p.id),
            }
          },
        });
        if (fps.length) {
          for (const fp of fps) {
            if (Array.isArray(fp.actions) && fp.actions.includes(`${resourceField.options.collection_name}:${actionName}`)) {
              return next();
            }
          }
          return this.reject(ctx);
        }
      }
      result = await ctx.ac.can(resourceField.options.target).act(actionName).any();
    } else {
      result = await ctx.ac.can(resourceName).act(actionName).any();
    }

    if (!result) {
      return this.reject(ctx);
    }

    if (result === true) {
      return next();
    }

    ctx.action.mergeParams({
      filter: result.filter,
      // TODO: 在 fields 改进之前，先注释掉
      // fields: result.fields.map(item => item.get('field').get('name'))
    });

    return next();
  };
  
  reject(ctx) {
    ctx.throw(404);
  }
}

export default async function (options = {}) {
  const instance = new Permissions(this, options);

  return instance;
}
