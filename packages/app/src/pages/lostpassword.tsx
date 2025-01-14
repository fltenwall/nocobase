import React from 'react';
import { Helmet, useModel } from 'umi';
import get from 'lodash/get';
import { LostPassword } from '@/components/views/LostPassword';

export default (props: any) => {
  const { initialState = {}, refresh, setInitialState } = useModel(
    '@@initialState',
  );
  const siteTitle = get(initialState, 'systemSettings.title');
  return (
    <div>
      <Helmet>
        <title>{siteTitle ? `忘记密码 - ${siteTitle}` : '忘记密码'}</title>
      </Helmet>
      <LostPassword {...props} />
    </div>
  );
};
