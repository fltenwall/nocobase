// @ts-ignore
global.sync = {
  force: true,
  alter: {
    drop: true,
  },
};

import Database from '@nocobase/database';
import api from '../app';

const data = [
  {
    title: '后台应用',
    path: '/',
    type: 'layout',
    template: 'TopMenuLayout',
    sort: 10,
    redirect: '/admin',
  },
  {
    title: '后台',
    path: '/admin',
    type: 'page',
    inherit: false,
    template: 'AdminLoader',
    order: 230,
  },
  {
    title: '登录页面',
    path: '/login',
    type: 'page',
    inherit: false,
    template: 'login',
    order: 120,
  },
  {
    title: '注册页面',
    path: '/register',
    type: 'page',
    inherit: false,
    template: 'register',
    order: 130,
  },
  {
    title: '忘记密码',
    path: '/lostpassword',
    type: 'page',
    inherit: false,
    template: 'lostpassword',
    order: 140,
  },
  {
    title: '重置密码',
    path: '/resetpassword',
    type: 'page',
    inherit: false,
    template: 'resetpassword',
    order: 150,
  },
];

(async () => {
  await api.loadPlugins();
  const database: Database = api.database;
  await database.sync({
    // tables: ['collections', 'fields', 'actions', 'views', 'tabs'],
  });
  const [Collection, Page, User] = database.getModels(['collections', 'pages', 'users']);
  const tables = database.getTables([]);
  for (let table of tables) {
    // console.log(table.getName());
    if (table.getName() === 'roles') {
      // console.log('roles', table.getOptions())
    }
    await Collection.import(table.getOptions(), { update: true, migrate: false });
  }
  await Page.import(data);

  const user = await User.create({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  const Storage = database.getModel('storages');
  await Storage.create({
    title: '本地存储',
    name: `local`,
    type: 'local',
    baseUrl: process.env.LOCAL_STORAGE_BASE_URL,
    default: process.env.STORAGE_TYPE === 'local',
  });
  await Storage.create({
    name: `ali-oss`,
    type: 'ali-oss',
    baseUrl: process.env.ALI_OSS_STORAGE_BASE_URL,
    options: {
      region: process.env.ALI_OSS_REGION,
      accessKeyId: process.env.ALI_OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALI_OSS_ACCESS_KEY_SECRET,
      bucket: process.env.ALI_OSS_BUCKET,
    },
    default: process.env.STORAGE_TYPE === 'ali-oss',
  });
  const Role = database.getModel('roles');
  if (Role) {
    const roles = await Role.bulkCreate([
      { title: '系统开发组', type: -1 },
      // { title: '匿名用户组', type: 0 },
      { title: '普通用户组', default: true },
    ]);
    await roles[0].updateAssociations({
      users: user
    });
  }

  const Action = database.getModel('actions');
  // 全局
  await Action.bulkCreate([
  ]);

  // 导入地域数据
  const ChinaRegion = database.getModel('china_regions');
  ChinaRegion && await ChinaRegion.importData();

  const Menu = database.getModel('menus');

  const menus = [
    {
      title: '仪表盘',
      icon: 'DashboardOutlined',
      type: 'group',
      children: [
        {
          title: '欢迎光临',
          icon: 'DatabaseOutlined',
          type: 'page',
          views: [],
          name: 'welcome',
        },
      ],
    },
    {
      title: '数据',
      icon: 'DatabaseOutlined',
      type: 'group',
      children: [],
    },
    {
      title: '用户',
      icon: 'TeamOutlined',
      type: 'group',
      children: [
        {
          title: '用户管理',
          icon: 'DatabaseOutlined',
          type: 'page',
          views: ['users.table'],
          name: 'users',
        },
      ],
    },
    {
      title: '日志',
      icon: 'NotificationOutlined',
      type: 'group',
      developerMode: true,
      children: [
        {
          title: '操作记录',
          icon: 'DatabaseOutlined',
          type: 'group',
          developerMode: true,
          children: [
            {
              title: '全部数据',
              type: 'page',
              views: ['action_logs.table'],
              developerMode: true,
              name: 'auditing',
            },
            {
              title: '新增数据',
              type: 'page',
              views: ['action_logs.create'],
              developerMode: true,
              name: 'create-auditing',
            },
            {
              title: '更新数据',
              type: 'page',
              views: ['action_logs.update'],
              developerMode: true,
              name: 'update-auditing',
            },
            {
              title: '删除数据',
              type: 'page',
              views: ['action_logs.destroy'],
              developerMode: true,
              name: 'destroy-auditing',
            },
          ],
        },
      ],
    },
    {
      title: '配置',
      icon: 'SettingOutlined',
      type: 'group',
      developerMode: true,
      children: [
        {
          name: 'menus',
          title: '菜单和页面配置',
          icon: 'MenuOutlined',
          type: 'page',
          views: ['menus.table'],
          developerMode: true,
        },
        {
          name: 'collections',
          title: '数据表配置',
          icon: 'DatabaseOutlined',
          type: 'page',
          views: ['collections.table'],
          developerMode: true,
        },
        {
          name: 'permissions',
          title: '权限配置',
          icon: 'MenuOutlined',
          type: 'page',
          views: ['roles.table'],
          developerMode: true,
        },
        {
          name: 'automations',
          title: '自动化配置',
          icon: 'MenuOutlined',
          type: 'page',
          views: ['automations.table'],
          developerMode: true,
        },
        {
          name: 'system_settings',
          title: '系统配置',
          icon: 'DatabaseOutlined',
          type: 'page',
          views: ['system_settings.descriptions'],
          developerMode: true,
        },
      ],
    },
  ];

  for (const item of menus) {
    const menu = await Menu.create(item);
    await menu.updateAssociations(item);
  }
  await database.close();
})();
