import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import { Construct } from 'constructs';

export interface GGManagerProps {}

export class GGManager extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const stack = cdk.Stack.of(scope);

    const carThingGroup = new iot.CfnThingGroup(this, 'carThingGroup', {
      queryString: 'queryString',
      tags: [
        {
          key: 'group',
          value: 'DREM',
        },
        { key: 'type', value: 'car' },
      ],
      thingGroupName: 'DREM-Car',
      thingGroupProperties: {
        thingGroupDescription: 'DREM - Cars',
      },
    });

    const timerThingGroup = new iot.CfnThingGroup(this, 'timerThingGroup', {
      queryString: 'queryString',
      tags: [
        {
          key: 'group',
          value: 'DREM',
        },
        { key: 'type', value: 'timer' },
      ],
      thingGroupName: 'DREM-Timer',
      thingGroupProperties: {
        thingGroupDescription: 'DREM - Timer',
      },
    });
  }
}
