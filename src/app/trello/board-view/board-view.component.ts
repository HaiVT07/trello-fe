import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {BoardService} from "../../service/board/board.service";
import {AuthenticateService} from "../../service/authenticate.service";
import {ToastService} from "../../service/toast/toast.service";
import {UserService} from "../../service/user/user.service";
import {Board} from "../../model/board";
import {UserToken} from "../../model/user-token";
import {User} from "../../model/user";
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {Column} from "../../model/column";
import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {ColumnService} from "../../service/column/column.service";
import {Card} from "../../model/card";
import {CardService} from "../../service/card/card.service";
import {TagService} from "../../service/tag/tag.service";
import {Tag} from "../../model/tag";
import {AngularFireStorage} from "@angular/fire/compat/storage";
import {finalize} from "rxjs/operators";
import {Attachment} from "../../model/attachment";
import {DetailedMember} from "../../model/detailed-member";
import {RedirectService} from "../../service/redirect/redirect.service";
import {AttachmentService} from "../../service/attachment/attachment.service";
import {MemberService} from "../../service/member/member.service";

@Component({
  selector: 'app-board-view',
  templateUrl: './board-view.component.html',
  styleUrls: ['./board-view.component.scss']
})
export class BoardViewComponent implements OnInit {
  currentUser: UserToken = {};
  fileSrc: any | undefined = null;
  selectedFile: any | undefined = null;
  isSubmitted = false;
  members: DetailedMember[] = [];
  currentBoardId: number = -1;
  tags: Tag[] = [];
  currentBoard: Board = {
    id: -1,
    owner: {},
    title: '',
    columns: []
  }
  loggedInUser: UserToken = {};
  user: User = {};
  canEdit: boolean = false;

  columnForm: FormGroup = new FormGroup({
    title: new FormControl('', Validators.required),
  })

  createCardForm: FormGroup = new FormGroup({
    title: new FormControl('', Validators.required),
    content: new FormControl()
  })

  isAdded: boolean = false;
  selectedCard: Card = {
    id: -1,
    title: '',
    content: '',
    position: -1,
  }
  selectedCardAttachment: Attachment[] = []
  selectedColumn: Column = {
    cards: [],
    id: -1,
    position: -1,
    title: ""
  }
  selectedColumnID: number = -1;
  selectedIndex: number = -1;
  cardsDto: Card[] = [];
  columnsDto: Column[] = [];

  previousColumn: Column = {
    cards: [],
    id: -1,
    position: -1,
    title: ""
  };

  newTagForm: FormGroup = new FormGroup({
    color: new FormControl('', Validators.required),
    name: new FormControl(),
  })
  newAttachment: Attachment = {
    id: -1,
    source: ""
  }
  pendingAttachment: Attachment[] = [];
  pendingTag: Tag[] = [];
  selectedAttachmentId: number = -1;

  isTagsIsShown : boolean = false;

  constructor(private activatedRoute: ActivatedRoute,
              private boardService: BoardService,
              public authenticationService: AuthenticateService,
              private router: Router,
              private toastService: ToastService,
              private userService: UserService,
              private columnService: ColumnService,
              private cardService: CardService,
              private tagService: TagService,
              private storage: AngularFireStorage,
              public redirectService: RedirectService,
              private attachmentService: AttachmentService,
              private memberService:MemberService) {
  }

  ngOnInit(): void {
    this.getCurrentBoardByURL()
  }

  //CARD

  dropCard(event: CdkDragDrop<Card[]>, column: Column) {
    if (!this.canEdit) {
      return
    }
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex);
    }
    this.setPreviousColumn(event);
    this.saveChange()
  }

  updateCards() {
    this.cardService.updateCards(this.cardsDto).subscribe(() => this.updatePreviousColumn())
  }

  showCreateCardModal(column: Column) {
    this.selectedColumn = column;
    document.getElementById('createCardModal')!.classList.add('is-active')
  }


  createCard() {
    if (this.createCardForm.valid) {
      let newCard: Card = {
        title: this.createCardForm.get('title')?.value,
        content: this.createCardForm.get('content')?.value,
        position: this.selectedColumn.cards.length
      }
      this.resetCreateCardForm();
      this.cardService.createCard(newCard).subscribe(data => {
        if (this.pendingAttachment.length > 0) {
          for (let attachment of this.pendingAttachment) {
            attachment.card = data;
            this.attachmentService.addNewFile(attachment).subscribe(() => {
            })
          }
        }
        if (this.pendingTag.length > 0) {
          for (let tags of this.pendingTag) {
            data.tags?.push(tags);
          }
        }
        this.selectedColumn.cards.push(data)
        this.columnService.updateAColumn(this.selectedColumn.id, this.selectedColumn).subscribe()
        this.closeCreateCardModal()
      })
    }
  }

  resetCreateCardForm() {
    this.createCardForm = new FormGroup({
      title: new FormControl('', Validators.required),
      content: new FormControl()
    })
  }

  closeCreateCardModal() {
    this.switchCreateTagsForm()
    this.resetCreateCardForm();
    this.selectedColumnID = -1;
    this.pendingAttachment = [];
    this.pendingTag = [];
    if(this.isTagsIsShown){this.switchCreateTagsForm()}
    document.getElementById('createCardModal')!.classList.remove('is-active')
  }

  showEditCardModal(card: Card,column:Column) {
    this.selectedCard = card;
    this.selectedColumn = column;
    this.createCardForm.get('title')?.setValue(card.title);
    this.createCardForm.get('content')?.setValue(card.content);
    this.getSelectedCardAttachment();
    document.getElementById('editCardModal')!.classList.add('is-active')
  }

  editCard() {
    this.selectedCard.title = this.createCardForm.get('title')?.value;
    this.selectedCard.content = this.createCardForm.get('content')?.value;
    this.resetCreateCardForm();
    this.cardService.updateCard(this.selectedCard.id, this.selectedCard).subscribe(() => {
      this.getCurrentBoard()
      this.closeEditCardModal()
    })
  }

  closeEditCardModal() {
    this.resetCreateCardForm();
    if(this.isTagsIsShown){
      this.switchEditTagsForm()
    }
    document.getElementById('editCardModal')!.classList.remove('is-active')
  }

  showDeleteCardModal() {
    document.getElementById("delete-card-modal")!.classList.add("is-active")
  }

  deleteCard(id: any) {
    this.cardService.deleteCard(id).subscribe(() => {
        this.closeDeleteCardModal();
        this.closeEditCardModal();
        this.getCurrentBoard()
      }
    )
  }

  closeDeleteCardModal() {
    document.getElementById("delete-card-modal")!.classList.remove("is-active")
  }

  //END CARD

  //TAG
  showDeleteTag(id: number) {
    document.getElementById('tagDeleteButton-' + id)!.classList.remove('is-hidden');
  }

  hideDeleteTag(id: number) {
    document.getElementById('tagDeleteButton-' + id)!.classList.add('is-hidden');
  }

  showDeleteTags(id: number) {
    document.getElementById('tagsDeleteButton-' + id)!.classList.remove('is-hidden');
  }

  hideDeleteTags(id: number) {
    document.getElementById('tagsDeleteButton-' + id)!.classList.add('is-hidden');
  }

  addNewTag() {
    let tag: Tag = this.newTagForm.value;
    console.log(tag)
    this.tagService.add(tag).subscribe(tag => {
      console.log(tag.name)
      this.currentBoard.tags?.push(tag);
      this.boardDataUpdate();
      this.newTagForm = new FormGroup({
        color: new FormControl("is-primary"),
        name: new FormControl("")
      })
    })
  }

  switchEditTagsForm() {
    let tagForm = document.getElementById('editTags');
    if (tagForm!.classList.contains('is-hidden')) {
      tagForm!.classList.remove('is-hidden');
      this.isTagsIsShown = true
    } else {
      tagForm!.classList.add('is-hidden');
      this.isTagsIsShown = false
    }
  }

  switchCreateTagsForm() {
    let tagForm = document.getElementById('createTags');
    if (tagForm!.classList.contains('is-hidden')) {
      tagForm!.classList.remove('is-hidden');
      this.isTagsIsShown = true
    } else {
      tagForm!.classList.add('is-hidden');
      this.isTagsIsShown = false
    }
  }

  removeTagFromCard(tag: Tag) {
    for (let tags of this.selectedCard.tags!) {
      if (tags.id == tag.id) {
        let index = this.selectedCard.tags?.indexOf(tags);
        this.selectedCard.tags?.splice(index!, 1);
      }
    }
    this.cardService.updateCard(this.selectedCard.id, this.selectedCard).subscribe(() => {
      this.saveChange()
    })
  }

  addTagToCard(tag: Tag) {
    for (let tags of this.selectedCard.tags!) {
      if (tags.id == tag.id) {
        this.toastService.showMessage("Nhãn đã có trong thẻ", "is-danger")
        return
      }
    }
    this.selectedCard.tags?.push(tag);
    this.cardService.updateCard(this.selectedCard.id, this.selectedCard).subscribe(() => {
      this.saveChange()
    })
  }

  addTagToPending(tag: Tag) {
    for (let tags of this.pendingTag) {
      if (tags.id == tag.id) {
        this.toastService.showMessage("Nhãn đã có trong thẻ", "is-danger")
        return
      }
    }
    this.pendingTag.push(tag)
  }

  deleteTag(id: number) {
    for (let column of this.currentBoard.columns) {
      for (let card of column.cards) {
        for (let tag of card.tags!) {
          if (tag.id == id) {
            let deleteIndex = card.tags!.indexOf(tag);
            card.tags!.splice(deleteIndex, 1);
          }
        }
      }
    }
    for (let tag of this.currentBoard.tags!) {
      if (tag.id == id) {
        let deleteIndex = this.currentBoard.tags!.indexOf(tag);
        this.currentBoard.tags!.splice(deleteIndex, 1);
      }
    }
    this.saveChange();
  }

  //END TAG

  //ATTACHMENT

  showPreview(event: any) {
    this.toastService.showMessage("Đang tải file xin vui lòng chờ", "is-warning")
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => this.fileSrc = event.target.result;
      reader.readAsDataURL(event.target.files[0]);
      this.selectedFile = event.target.files[0];
      if (this.selectedFile != null) {
        const filePath = `${this.selectedFile.name.split('.').splice(0, -1).join('.')}_${new Date().getTime()}`;
        const fileRef = this.storage.ref(filePath);
        this.storage.upload(filePath, this.selectedFile).snapshotChanges().pipe(
          finalize(() => {
            fileRef.getDownloadURL().subscribe(url => {
              this.fileSrc = url;
            });
          })).subscribe();
      }
    } else {
      this.selectedFile = null;
    }
    this.uploadFile()
  }

  pendingPreview(event: any) {
    this.toastService.showMessage("Đang tải file xin vui lòng chờ", "is-warning")
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => this.fileSrc = event.target.result;
      reader.readAsDataURL(event.target.files[0]);
      this.selectedFile = event.target.files[0];
      if (this.selectedFile != null) {
        const filePath = `${this.selectedFile.name.split('.').splice(0, -1).join('.')}_${new Date().getTime()}`;
        const fileRef = this.storage.ref(filePath);
        this.storage.upload(filePath, this.selectedFile).snapshotChanges().pipe(
          finalize(() => {
            fileRef.getDownloadURL().subscribe(url => {
              this.fileSrc = url;
              this.pendingAttachment.push({
                source: this.fileSrc,
                name: this.selectedFile.name,
              })
            });
          })).subscribe();
      }
    } else {
      this.selectedFile = null;
    }
  }

  uploadFile() {
    this.isSubmitted = true;
    // let isMember = false;
    // for (let member of this.members) {
    //   if (member.userId == this.currentUser.id) {
    //     // @ts-ignore
    //     this.newAttachment.member = member;
    //     isMember = true;
    //     this.newAttachment.card = this.selectedCard
    //     break;
    //   }
    // }
    this.newAttachment.card = this.selectedCard
    if (this.canEdit && this.selectedFile != null) {
      const filePath = `${this.selectedFile.name.split('.').slice(0, -1).join('.')}_${new Date().getTime()}`;
      const fileRef = this.storage.ref(filePath);
      this.storage.upload(filePath, this.selectedFile).snapshotChanges().pipe(
        finalize(() => {
          fileRef.getDownloadURL().subscribe(url => {
            this.fileSrc = url;
            this.newAttachment.source = url;
            this.newAttachment.name = `${this.selectedFile.name}`;
            this.newAttachment.card = this.selectedCard;
            console.log(this.newAttachment)
            this.attachmentService.addNewFile(this.newAttachment).subscribe(() => {
                this.toastService.showMessage("Upload success", 'is-success');
                this.getSelectedCardAttachment()
              },
              () => {
                this.toastService.showMessage("Fail !", 'is-danger');
              });
          });
        })).subscribe();
    }
  }

  getSelectedCardAttachment() {
    this.attachmentService.getAttachmentByCard(this.selectedCard.id).subscribe(data => {
      this.selectedCardAttachment = data;
    })
  }

  deletePendingAttachment(index: any) {
    for (let i = 0; i < this.pendingAttachment.length; i++) {
      if (this.pendingAttachment[index] == this.pendingAttachment[i]) {
        this.pendingAttachment.splice(index, 1);
        return
      }
    }
  }

  deleteAttachment() {
    this.attachmentService.deleteAttachmentById(this.selectedAttachmentId).subscribe(() => {
      this.getSelectedCardAttachment()
      this.hideDeleteAttachment()
    })
  }

  showDeleteAttachment(id: any) {
    this.selectedAttachmentId = id;
    document.getElementById('deleteAttachment')!.classList.add('is-active');
  }

  hideDeleteAttachment() {
    this.selectedAttachmentId = -1;
    document.getElementById('deleteAttachment')!.classList.remove('is-active');
  }

  //END ATTACHMENT

  //BOARD
  getCurrentBoardByURL() {
    this.loggedInUser = this.authenticationService.getCurrentUserValue();
    this.activatedRoute.paramMap.subscribe((param: ParamMap) => {
      this.currentBoardId = parseInt(param.get('id')!)
      this.getCurrentBoard()
    })
  }

  getMembers() {
    this.memberService.getMembersByBoardId(this.currentBoard.id).subscribe(members => {
      this.members = members;
    });
  }
  getCurrentBoard() {
    this.boardService.getBoardById(this.currentBoardId).subscribe(board => {
      this.currentBoard = board;
      this.getMembers()
      this.checkEditAllow();
    })
  }

  checkEditAllow() {
    let userId = this.loggedInUser.id
    let isEditAllow = userId == this.currentBoard.owner.id
    if (isEditAllow) {
      this.canEdit = true;
    }
  }

  boardDataUpdate() {
    this.boardService.updateBoard(this.currentBoardId, this.currentBoard).subscribe(() => {
      this.getCurrentBoard()
    })
  }

  //END BOARD

  //COlUMN

  addColumn() {
    if (this.columnForm.valid) {
      let newColumn: Column = {
        cards: [],
        position: this.currentBoard.columns.length,
        title: this.columnForm.get('title')?.value
      }
      this.resetColumnForm();
      this.columnService.createAColumn(newColumn).subscribe(data => {
        this.currentBoard.columns.push(data)
        this.boardDataUpdate()
        this.closeCreateColumnModal()
      })
    }
  }

  resetColumnForm() {
    this.columnForm = new FormGroup({
      title: new FormControl('', Validators.required),
    })
  }


  onFocusOut(column: Column) {
    this.columnService.updateAColumn(column.id, column).subscribe(() => {
      this.boardDataUpdate()
    })
  }

  dropColumn(event: CdkDragDrop<string[]>) {
    if (!this.canEdit) {
      return
    }
    moveItemInArray(this.currentBoard.columns, event.previousIndex, event.currentIndex);
    this.saveChange()
  }


  private setPreviousColumn(event: CdkDragDrop<Card[]>) {
    let previousColumnId = parseInt(event.previousContainer.id);
    for (let column of this.currentBoard.columns) {
      if (column.id == previousColumnId) {
        this.previousColumn = column;
        break;
      }
    }
  }

  saveChange() {
    this.updatePosition();
  }

  private updatePosition() {
    for (let i = 0; i < this.currentBoard.columns.length; i++) {
      this.currentBoard.columns[i].position = i
      for (let j = 0; j < this.currentBoard.columns[i].cards.length; j++) {
        this.currentBoard.columns[i].cards[j].position! = j;
      }
    }
    this.updateDto();
  }

  private updateDto() {
    this.columnsDto = [];
    this.cardsDto = [];
    for (let column of this.currentBoard.columns) {
      this.columnsDto.push(column);
      for (let card of column.cards) {
        this.cardsDto.push(card);
      }
    }
    this.updateCards()
  }

  private updatePreviousColumn() {
    if (this.previousColumn.id != -1) {
      this.columnService.updateAColumn(this.previousColumn.id, this.previousColumn).subscribe(() => this.updateColumns())
    } else {
      this.updateColumns()
    }
  }

  updateColumns() {
    this.columnService.updateAllColumn(this.columnsDto).subscribe(() => {
      this.boardDataUpdate()
    })
  }

  deleteColumn() {
    for (let i = 0; i < this.currentBoard.columns.length; i++) {
      if (this.currentBoard.columns[i].id == this.selectedColumnID) {
        this.selectedIndex = this.currentBoard.columns.indexOf(this.currentBoard.columns[i])
        this.currentBoard.columns.splice(this.selectedIndex, 1);
        console.log(this.currentBoard.columns);
        this.columnService.deleteAColumn(this.selectedColumnID).subscribe(() => {
          this.saveChange()
          this.closeDeleteColumnModal();
        })
      }
    }
  }

  showDeleteColumnModal(id: number) {
    this.selectedColumnID = id;
    document.getElementById('deleteColumnModal')!.classList.add('is-active')
  }

  closeDeleteColumnModal() {
    this.selectedColumnID = -1;
    this.selectedIndex = -1;
    document.getElementById('deleteColumnModal')!.classList.remove('is-active')
  }

  showCreateColumnModal() {
    document.getElementById('createColumnModal')!.classList.add("is-active")
  }

  closeCreateColumnModal() {
    document.getElementById('createColumnModal')!.classList.remove("is-active")
  }

}
