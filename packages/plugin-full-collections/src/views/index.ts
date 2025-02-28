import * as types from './types';

export const views = new Map();

export function registerView(type: string, value: any) {
  views.set(type, value);
}

export function registerViews(values: any) {
  Object.keys(values).forEach(type => {
    registerView(type, {
      ...values[type],
      type,
    });
  });
}

registerViews(types);

export function getOptions() {
  const options = [];
  for (const [type, view] of views) {
    options.push({
      key: type,
      value: type,
      label: view.title,
    });
  }
  return options;
}

export function getViewTypeLinkages() {
  let xlinkages = [];
  for (const [key, item] of views) {
    const { linkages = {}, properties = {} } = item;
    xlinkages.push({
      "type": "value:visible",
      "target": `x-${key}-props.*`,
      "condition": `{{ $self.value === '${key}' }}`,
    });
    if (linkages.type) {
      xlinkages = xlinkages.concat(linkages.type.map(linkage => {
        if (properties[linkage.target]) {
          linkage.condition = `{{ $self.value === '${key}' }}`;
          linkage.target = `x-${key}-props.${linkage.target}`;
        }
        return linkage;
      }));
    }
  }
  return xlinkages;
}

export function getViewFields() {
  const fields = new Map();
  fields.set('type', {
    interface: 'select',
    type: 'string',
    name: 'type',
    title: '视图类型',
    required: true,
    dataSource: getOptions(),
    createOnly: true,
    component: {
      type: 'select',
    },
    linkages: getViewTypeLinkages(),
  });
  for (const [key, item] of views) {
    const { properties = {}, linkages = {} } = item;
    Object.keys(properties).forEach(name => {
      const property = {
        ...properties[name],
        name,
      };
      if (!property.type) {
        property.type = 'virtual';
      }
      if (property.type === 'virtual') {
        property.name = `x-${key}-props.${name}`;
      }
      if (linkages[name]) {
        property.linkages = linkages[name].map((linkage: any) => {
          linkage.target = `x-${key}-props.${linkage.target}`;
          return linkage;
        });
      }
      fields.set(`x-${key}-props.${name}`, property);
    });
  }
  return [...fields.values()];
}
