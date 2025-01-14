import React, { useRef } from 'react';
import './style.less';
import { Helmet } from 'umi';
import { Spin } from '@/components/spin';
import { useRequest, useLocation } from 'umi';
import api from '@/api-client';
import { Actions } from '@/components/actions';
import {
  Table as AntdTable,
  Card,
  Pagination,
  Button,
  Tabs,
  Descriptions as AntdDescriptions,
  Tooltip,
} from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import arrayMove from 'array-move';
import get from 'lodash/get';
import Drawer from '@/components/drawer';
import Field from '@/components/views/Field';
import { Form } from './Form';
import { configResponsive, useResponsive } from 'ahooks';
import { InfoCircleOutlined } from '@ant-design/icons';

configResponsive({
  small: 0,
  middle: 800,
  large: 1200,
});
function toGroups(fields: any[]) {
  const groups = [];
  let group = {
    title: undefined,
    tooltip: undefined,
    children: [],
  };
  fields.forEach(field => {
    if (field.interface === 'description') {
      if (group.children.length) {
        groups.push(group);
      }
      group = {
        title: field.title,
        tooltip: field.tooltip,
        children: [],
      };
    } else {
      group.children.push(field);
    }
  });
  if (group.children.length) {
    groups.push(group);
  }
  return groups;
}

export function Descriptions(props) {
  const { data: record = {}, schema = {}, onDataChange } = props;
  const {
    rowKey = 'id',
    resourceName,
    fields = [],
    actions = [],
    appends = [],
    associationField = {},
  } = schema;
  const responsive = useResponsive();

  const resourceKey =
    props.resourceKey || record[associationField.targetKey || rowKey];
  const associatedKey =
    props.associatedKey || record[associationField.sourceKey || 'id'];

  // console.log({resourceKey, data: record, associatedKey, associationField})

  const { data = {}, loading, refresh } = useRequest(() => {
    return api.resource(resourceName).get({
      resourceKey,
      associatedKey,
      'fields[appends]': appends,
    });
  });
  const contentRef = useRef();
  if (loading) {
    return <Spin />;
  }
  let descriptionsProps: any = {
    size: 'middle',
    bordered: true,
  };
  if (responsive.small && !responsive.middle && !responsive.large) {
    descriptionsProps = {
      layout: 'vertical',
    };
  }
  const groups = toGroups(fields);

  return (
    <div>
      <Actions
        onTrigger={{
          async update(values) {
            refresh();
            onDataChange && onDataChange(values);
          },
        }}
        contentRef={contentRef}
        associatedKey={associatedKey}
        data={data}
        actions={actions}
        style={{ marginBottom: 14 }}
      />
      <div ref={contentRef} className={'print-content'}>
        {groups.map(group => (
          <AntdDescriptions
            // layout={'vertical'}
            // size={'middle'}
            // bordered
            {...descriptionsProps}
            title={
              group.title && (
                <span>
                  {group.title}{' '}
                  {group.tooltip && (
                    <Tooltip title={group.tooltip}>
                      <InfoCircleOutlined />
                    </Tooltip>
                  )}
                </span>
              )
            }
            column={1}
          >
            {group.children.map((field: any) => {
              const label = field.tooltip ? (
                <>
                  {field.title || field.name}&nbsp;
                  <Tooltip title={field.tooltip}>
                    <InfoCircleOutlined />
                  </Tooltip>
                </>
              ) : (
                field.title || field.name
              );
              return (
                <AntdDescriptions.Item label={label}>
                  <Field
                    data={data}
                    viewType={'descriptions'}
                    schema={field}
                    value={get(data, field.name)}
                  />
                </AntdDescriptions.Item>
              );
            })}
          </AntdDescriptions>
        ))}
      </div>
    </div>
  );
}
