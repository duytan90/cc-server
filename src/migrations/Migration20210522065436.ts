import { Migration } from '@mikro-orm/migrations';

export class Migration20210522065436 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "post" rename column "ownerid" to "owner_id";');
  }

}
